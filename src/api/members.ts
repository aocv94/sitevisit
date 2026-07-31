import { getSupabase } from '@/lib/supabase';
import type { OrgMember, OrgRole, Profile } from '@/types/db';

interface MemberRow {
  role: OrgRole;
  profile: Profile | Profile[] | null;
}

const PROFILE_COLUMNS = 'id, email, full_name, is_app_owner, invited_at, accepted_at, created_at';

export async function listOrgMembers(orgId: string): Promise<OrgMember[]> {
  const { data, error } = await getSupabase()
    .from('memberships')
    .select(`role, profile:profiles(${PROFILE_COLUMNS})`)
    .eq('org_id', orgId);
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as MemberRow[]).flatMap((row) => {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    return profile ? [{ role: row.role, profile }] : [];
  });
}

export interface InviteResult {
  userId: string;
  /** false si la persona ya tenia cuenta y solo se le dio acceso. */
  invited: boolean;
  orgName: string;
  role: OrgRole;
}

/**
 * Alta de una persona en una empresa.
 *
 * Pasa por la Edge Function porque crear usuarios exige la service_role, que
 * no puede vivir en el navegador. La comprobacion de permisos se rehace alli
 * con el JWT: que este boton solo se pinte para lideres no protege nada.
 */
export async function inviteUser(input: {
  email: string;
  orgId: string;
  role: OrgRole;
  fullName?: string;
}): Promise<InviteResult> {
  const { data, error } = await getSupabase().functions.invoke<InviteResult>('invite-user', {
    body: {
      email: input.email,
      orgId: input.orgId,
      role: input.role,
      ...(input.fullName ? { fullName: input.fullName } : {}),
    },
  });

  if (error) {
    // El cuerpo de error de la function trae el motivo real; el error de
    // invoke solo dice que dio no-2xx.
    const detail = await readFunctionError(error);
    throw new Error(detail ?? error.message);
  }
  if (!data) throw new Error('La invitación no devolvió resultado');
  return data;
}

async function readFunctionError(error: unknown): Promise<string | null> {
  const response = (error as { context?: Response }).context;
  if (!response || typeof response.json !== 'function') return null;
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? null;
  } catch {
    return null;
  }
}

export async function updateMemberRole(
  orgId: string,
  userId: string,
  role: OrgRole
): Promise<void> {
  const { error } = await getSupabase()
    .from('memberships')
    .update({ role })
    .eq('org_id', orgId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

/**
 * Quita el acceso a esta empresa. No borra la cuenta: la persona puede
 * pertenecer a otras, y sus reportes ya emitidos siguen siendo el registro
 * de lo que se observó.
 */
export async function removeMember(orgId: string, userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('memberships')
    .delete()
    .eq('org_id', orgId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}
