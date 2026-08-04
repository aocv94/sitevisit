import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { isLeaderRole, type MembershipWithOrg, type Org, type Profile } from '@/types/db';
import { AuthContext, type AuthState } from './authContext';

/** Forma cruda de la consulta con la empresa embebida. */
interface MembershipRow {
  user_id: string;
  org_id: string;
  role: MembershipWithOrg['role'];
  org: Org | Org[] | null;
}

const ORG_COLUMNS = 'id, name, logo_url, brand_color, disclaimer, created_at';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionResolved, setSessionResolved] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<MembershipWithOrg[]>([]);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = session?.user.id ?? null;

  // Restauracion de sesion + suscripcion a los cambios. El listener solo
  // guarda la sesion: llamar a la API de Supabase dentro del callback puede
  // bloquear el cliente, asi que el perfil se carga en otro efecto.
  useEffect(() => {
    const supabase = getSupabase();
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setSessionResolved(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setSessionResolved(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadProfile = useCallback(async (id: string) => {
    const supabase = getSupabase();
    setError(null);
    try {
      const [profileResult, membershipResult] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
        supabase
          .from('memberships')
          .select(`user_id, org_id, role, org:orgs(${ORG_COLUMNS})`)
          .eq('user_id', id),
      ]);

      if (profileResult.error) throw profileResult.error;
      if (membershipResult.error) throw membershipResult.error;

      setProfile((profileResult.data as Profile | null) ?? null);
      const rows = (membershipResult.data ?? []) as unknown as MembershipRow[];
      setMemberships(
        rows.flatMap((row) => {
          // PostgREST devuelve la relacion como objeto o como array de uno
          // segun como infiera la cardinalidad; se normaliza aqui.
          const org = Array.isArray(row.org) ? row.org[0] : row.org;
          if (!org) return [];
          return [{ user_id: row.user_id, org_id: row.org_id, role: row.role, org }];
        })
      );
    } catch (cause) {
      setProfile(null);
      setMemberships([]);
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar el perfil');
    } finally {
      setProfileLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setMemberships([]);
      setProfileLoaded(false);
      return;
    }
    setProfileLoaded(false);
    void loadProfile(userId);
  }, [userId, loadProfile]);

  const reload = useCallback(async () => {
    if (userId) await loadProfile(userId);
  }, [userId, loadProfile]);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
  }, []);

  const value = useMemo<AuthState>(() => {
    let status: AuthState['status'];
    if (!sessionResolved) status = 'loading';
    else if (!session) status = 'signed-out';
    else status = profileLoaded ? 'signed-in' : 'loading';

    return {
      status,
      session,
      profile,
      memberships,
      isAppOwner: profile?.is_app_owner === true,
      leaderOrgs: memberships.filter((m) => isLeaderRole(m.role)),
      error,
      reload,
      signOut,
    };
  }, [sessionResolved, session, profile, memberships, profileLoaded, error, reload, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
