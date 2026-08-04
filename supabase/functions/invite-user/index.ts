/**
 * Alta de un usuario en una empresa, por invitacion.
 *
 * Vive en una Edge Function y no en el navegador porque crear usuarios exige
 * la service_role, que salta TODAS las policies RLS. Esa clave nunca puede
 * viajar al cliente: quien la tenga lee y escribe cualquier fila de cualquier
 * empresa.
 *
 * El invitado recibe un enlace y elige su propia contraseña. Nadie, ni su
 * lider, llega a conocerla.
 *
 * Autorizacion, en este orden:
 *   1. El JWT del header identifica a quien llama. No se acepta ningun
 *      user_id que venga en el body.
 *   2. Dueño de la app -> cualquier rol en cualquier empresa.
 *      Lider de empresa -> 'member' o 'admin', y solo en SU empresa.
 *   3. Cualquier otro -> 403.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';

type OrgRole = 'owner' | 'admin' | 'member';

const ASSIGNABLE_ROLES: OrgRole[] = ['owner', 'admin', 'member'];
/** Lo que un lider puede repartir. Un lider no nombra a otro 'owner'. */
const LEADER_ASSIGNABLE_ROLES: OrgRole[] = ['admin', 'member'];

interface InviteRequest {
  email?: string;
  orgId?: string;
  role?: OrgRole;
  fullName?: string;
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return errorResponse('Method not allowed', 405);

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return errorResponse('Falta la cabecera Authorization', 401);

  // Cliente "como el que llama": hereda su JWT y por tanto sus permisos.
  const callerClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser();
  if (callerError || !caller) return errorResponse('Sesion no valida', 401);

  let body: InviteRequest;
  try {
    body = (await req.json()) as InviteRequest;
  } catch {
    return errorResponse('El cuerpo debe ser JSON', 400);
  }

  const email = body.email?.trim().toLowerCase();
  const orgId = body.orgId?.trim();
  const role = body.role;
  const fullName = body.fullName?.trim() || null;

  if (!email || !email.includes('@')) return errorResponse('Email no valido', 400);
  if (!orgId) return errorResponse('Falta orgId', 400);
  if (!role || !ASSIGNABLE_ROLES.includes(role)) return errorResponse('Rol no valido', 400);

  // Cliente administrador. A partir de aqui no hay RLS que nos frene, asi
  // que cada consulta lleva su filtro puesto a mano.
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: callerProfile } = await admin
    .from('profiles')
    .select('is_app_owner')
    .eq('id', caller.id)
    .maybeSingle();

  const isAppOwner = callerProfile?.is_app_owner === true;

  if (!isAppOwner) {
    const { data: callerMembership } = await admin
      .from('memberships')
      .select('role')
      .eq('user_id', caller.id)
      .eq('org_id', orgId)
      .maybeSingle();

    const isLeader =
      callerMembership?.role === 'owner' || callerMembership?.role === 'admin';
    if (!isLeader) {
      return errorResponse('No puedes invitar a esta empresa', 403);
    }
    if (!LEADER_ASSIGNABLE_ROLES.includes(role)) {
      return errorResponse('Solo el dueño de la app puede nombrar lideres', 403);
    }
  }

  const { data: org } = await admin.from('orgs').select('id, name').eq('id', orgId).maybeSingle();
  if (!org) return errorResponse('La empresa no existe', 404);

  // ¿Ya tiene cuenta? Entonces no se reinvita: basta con darle acceso a esta
  // empresa. Reinvitar le invalidaria la contraseña que ya usa.
  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  let userId = existing?.id ?? null;
  let invited = false;

  if (!userId) {
    // El enlace vuelve al sitio DESDE EL QUE se invita: en local a
    // localhost, en produccion al dominio. Sin esto habria que cambiar un
    // secreto cada vez que se pasa de uno a otro.
    //
    // Que el origen lo mande el navegador no lo hace peligroso: Supabase
    // rechaza cualquier redirectTo que no este en la lista de Redirect URLs
    // del proyecto, asi que la lista es la que manda, no esta cabecera.
    // PUBLIC_APP_URL queda de reserva para llamadas sin Origin (curl, cron).
    const origin = req.headers.get('Origin') ?? Deno.env.get('PUBLIC_APP_URL');
    const { data: invite, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: fullName ? { full_name: fullName } : undefined,
      ...(origin ? { redirectTo: `${origin}/aceptar-invitacion` } : {}),
    });
    if (inviteError || !invite?.user) {
      return errorResponse(inviteError?.message ?? 'No se pudo enviar la invitacion', 400);
    }
    userId = invite.user.id;
    invited = true;
  }

  // Idempotente: reinvitar a alguien que ya esta dentro actualiza su rol en
  // vez de reventar por clave duplicada.
  const { error: membershipError } = await admin
    .from('memberships')
    .upsert({ user_id: userId, org_id: orgId, role }, { onConflict: 'user_id,org_id' });

  if (membershipError) {
    return errorResponse(`No se pudo dar el acceso: ${membershipError.message}`, 400);
  }

  if (fullName) {
    await admin.from('profiles').update({ full_name: fullName }).eq('id', userId);
  }

  return jsonResponse({ userId, invited, orgName: org.name, role });
});
