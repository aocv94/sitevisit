import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './authContext';

export function LoadingScreen({ message = 'Cargando…' }: { message?: string }) {
  return (
    <div className="adm-center">
      <p className="adm-muted">{message}</p>
    </div>
  );
}

/**
 * Estas guardas son comodidad de navegacion, NO seguridad. Quien tenga la
 * anon key puede llamar a la API sin pasar por React. Lo que de verdad
 * protege los datos son las policies RLS de supabase/migrations.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <LoadingScreen />;
  if (status === 'signed-out') {
    // Se recuerda a donde iba para devolverlo ahi despues del login.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

export function RequireAppOwner({ children }: { children: ReactNode }) {
  const { status, isAppOwner } = useAuth();
  if (status === 'loading') return <LoadingScreen />;
  if (status === 'signed-out') return <Navigate to="/login" replace />;
  if (!isAppOwner) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function RequireLeader({ children }: { children: ReactNode }) {
  const { status, isAppOwner, leaderOrgs } = useAuth();
  if (status === 'loading') return <LoadingScreen />;
  if (status === 'signed-out') return <Navigate to="/login" replace />;
  if (!isAppOwner && leaderOrgs.length === 0) return <Navigate to="/" replace />;
  return <>{children}</>;
}

/** Para la captura: hace falta pertenecer a alguna empresa. */
export function RequireMembership({ children }: { children: ReactNode }) {
  const { status, memberships, isAppOwner } = useAuth();
  if (status === 'loading') return <LoadingScreen />;
  if (status === 'signed-out') return <Navigate to="/login" replace />;
  if (!isAppOwner && memberships.length === 0) return <Navigate to="/sin-empresa" replace />;
  return <>{children}</>;
}
