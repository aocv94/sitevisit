import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/auth/authContext';
import {
  LoadingScreen,
  RequireAppOwner,
  RequireAuth,
  RequireLeader,
  RequireMembership,
} from '@/auth/guards';
import { AcceptInvitePage } from '@/routes/AcceptInvitePage';
import { CapturePage } from '@/routes/CapturePage';
import { ForgotPasswordPage } from '@/routes/ForgotPasswordPage';
import { LeaderDashboard } from '@/routes/LeaderDashboard';
import { LoginPage } from '@/routes/LoginPage';
import { NoOrgPage } from '@/routes/NoOrgPage';
import { OwnerDashboard } from '@/routes/OwnerDashboard';
import { SignUpPage } from '@/routes/SignUpPage';

/**
 * A donde va cada quien al entrar. El dueño de la app aterriza en la
 * plataforma, el lider en su empresa y el colaborador directo a capturar,
 * que es lo unico que necesita.
 */
function Landing() {
  const { status, isAppOwner, leaderOrgs, memberships } = useAuth();

  if (status === 'loading') return <LoadingScreen />;
  if (status === 'signed-out') return <Navigate to="/login" replace />;
  if (isAppOwner) return <Navigate to="/admin" replace />;
  if (leaderOrgs.length > 0) return <Navigate to="/empresa" replace />;
  if (memberships.length > 0) return <Navigate to="/captura" replace />;
  return <Navigate to="/sin-empresa" replace />;
}

export function AppRoutes() {
  const { status, passwordRecovery } = useAuth();

  /**
   * Una recuperación en curso se atiende ANTES que cualquier ruta.
   *
   * Supabase no siempre aterriza donde se le pide: si la URL de vuelta no
   * está en su lista de Redirect URLs, cae al Site URL sin avisar. Entonces
   * la persona entraba en la app con sesión, sin haber elegido contraseña y
   * sin que nada se lo pidiera — que es justo lo que pasaba.
   */
  if (status === 'signed-in' && passwordRecovery) {
    return <AcceptInvitePage />;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/registro" element={<SignUpPage />} />
      <Route path="/recuperar" element={<ForgotPasswordPage />} />
      <Route path="/aceptar-invitacion" element={<AcceptInvitePage />} />

      <Route
        path="/sin-empresa"
        element={
          <RequireAuth>
            <NoOrgPage />
          </RequireAuth>
        }
      />
      <Route
        path="/cambiar-contrasena"
        element={
          <RequireAuth>
            <AcceptInvitePage mode="change" />
          </RequireAuth>
        }
      />
      <Route
        path="/admin"
        element={
          <RequireAppOwner>
            <OwnerDashboard />
          </RequireAppOwner>
        }
      />
      <Route
        path="/empresa"
        element={
          <RequireLeader>
            <LeaderDashboard />
          </RequireLeader>
        }
      />
      <Route
        path="/captura"
        element={
          <RequireMembership>
            <CapturePage />
          </RequireMembership>
        }
      />

      <Route path="/" element={<Landing />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
