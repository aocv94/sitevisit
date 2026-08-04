import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/AuthLayout';
import { useAuth } from '@/auth/authContext';
import { getSupabase } from '@/lib/supabase';

const MIN_PASSWORD = 8;

/**
 * Destino de los enlaces de correo: invitación y recuperación de contraseña.
 *
 * El enlace trae un token que `detectSessionInUrl` del cliente canjea por una
 * sesión antes de que se pinte nada. Por eso aquí ya hay sesión: lo único que
 * falta es fijar la contraseña.
 */
export function AcceptInvitePage() {
  const { status, profile, reload } = useAuth();
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
    // El trigger de auth.users ya habrá marcado accepted_at; se recarga para
    // que la app vea la empresa a la que le acaban de dar acceso.
    await reload();
    navigate('/', { replace: true });
  }

  // Aquí había una redirección para quien ya tenía `accepted_at`. Rompía la
  // recuperación de contraseña entera: ese campo se rellena al aceptar la
  // invitación, o sea que lo tiene TODO el que lleva tiempo usando la app —
  // justo quien pide un enlace de recuperación. El resultado era que el
  // enlace del correo te metía en la app sin dejarte cambiar nada.
  //
  // Llegar aquí con sesión significa que se acaba de canjear un enlace de un
  // solo uso, o que alguien ya dentro quiere cambiar su contraseña. En los
  // dos casos lo correcto es enseñar el formulario.

  return (
    <AuthLayout title="Elige tu contraseña" subtitle={profile?.email ?? undefined}>
      <form className="adm-form" onSubmit={handleSubmit}>
        <label className="adm-field">
          <span>Contraseña</span>
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
