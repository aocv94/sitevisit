import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/AuthLayout';
import { useAuth } from '@/auth/authContext';
import { getSupabase } from '@/lib/supabase';

const MIN_PASSWORD = 8;

interface Props {
  /**
   * `link` — se llegó desde el correo (invitación o recuperación).
   * `change` — alguien ya dentro quiere cambiar su contraseña.
   */
  mode?: 'link' | 'change';
}

/**
 * Fijar contraseña. Cubre los tres casos: aceptar una invitación, recuperar
 * la contraseña, y cambiarla desde dentro.
 *
 * Los dos primeros llegan con la sesión ya creada: `detectSessionInUrl` del
 * cliente canjea el token del enlace antes de que se pinte nada.
 */
export function AcceptInvitePage({ mode = 'link' }: Props) {
  const { status, profile, reload, passwordRecovery, clearPasswordRecovery } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'loading') {
    return <AuthLayout title="Un momento…">{null}</AuthLayout>;
  }

  if (status === 'signed-out') {
    return (
      <AuthLayout
        title="Enlace no válido"
        subtitle="El enlace ha caducado o ya se había usado."
        footer={<Link to="/recuperar">Pedir uno nuevo</Link>}
      >
        <p className="adm-muted">
          Los enlaces de invitación y de recuperación son de un solo uso y caducan.
        </p>
      </AuthLayout>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD) {
      setError(`La contraseña necesita al menos ${MIN_PASSWORD} caracteres`);
      return;
    }
    if (password !== confirmation) {
      setError('Las dos contraseñas no coinciden');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: updateError } = await getSupabase().auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setBusy(false);
      return;
    }
    // Se limpia la bandera ANTES de navegar: si no, la app volvería a
    // interceptar cualquier ruta para pedir la contraseña otra vez.
    clearPasswordRecovery();
    await reload();
    navigate('/', { replace: true });
  }

  const isRecovery = passwordRecovery || mode === 'link';

  return (
    <AuthLayout
      title={isRecovery ? 'Elige tu contraseña' : 'Cambiar contraseña'}
      subtitle={profile?.email ?? undefined}
      footer={mode === 'change' ? <Link to="/">Cancelar</Link> : undefined}
    >
      <form className="adm-form" onSubmit={handleSubmit}>
        <label className="adm-field">
          <span>{mode === 'change' ? 'Contraseña nueva' : 'Contraseña'}</span>
          <input
            type="password"
            value={password}
            autoComplete="new-password"
            required
            minLength={MIN_PASSWORD}
            onChange={(e) => setPassword(e.target.value)}
          />
          <small className="adm-muted">Mínimo {MIN_PASSWORD} caracteres.</small>
        </label>
        <label className="adm-field">
          <span>Repítela</span>
          <input
            type="password"
            value={confirmation}
            autoComplete="new-password"
            required
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </label>
        {error && <p className="adm-error">{error}</p>}
        <button className="adm-btn adm-btn-primary" type="submit" disabled={busy}>
          {busy ? 'Guardando…' : 'Guardar y entrar'}
        </button>
      </form>
    </AuthLayout>
  );
}
