import { useAuth } from '@/auth/authContext';
import { AuthLayout } from '@/components/AuthLayout';

/**
 * Donde acaba quien se registró por su cuenta sin que nadie le invitase.
 * Tiene cuenta, pero no pertenece a ninguna empresa, y sin empresa no hay
 * proyectos ni reportes que enseñarle.
 */
export function NoOrgPage() {
  const { profile, signOut, reload } = useAuth();

  return (
    <AuthLayout
      title="Cuenta sin empresa"
      subtitle={profile?.email ?? undefined}
      footer={
        <button className="adm-linklike" type="button" onClick={() => void signOut()}>
          Cerrar sesión
        </button>
      }
    >
      <p className="adm-muted">
        Tu cuenta está creada, pero todavía no tiene acceso a ninguna empresa. Quien dirija la tuya
        tiene que invitarte con este mismo email.
      </p>
      <button className="adm-btn adm-btn-ghost" type="button" onClick={() => void reload()}>
        Ya me han invitado, comprobar
      </button>
    </AuthLayout>
  );
}
