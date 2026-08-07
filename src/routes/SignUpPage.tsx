import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import type { AuthError } from '@supabase/supabase-js';
import { AuthLayout } from '@/components/AuthLayout';
import { useAuth } from '@/auth/authContext';
import { useAuthSettings } from '@/hooks/useAuthSettings';
import { getSupabase } from '@/lib/supabase';

const MIN_PASSWORD = 8;

/** Los mensajes de Supabase vienen en inglés y sin decir qué hacer. */
function describeSignUpError(error: AuthError): string {
  if (error.code === 'signup_disabled' || /signups not allowed/i.test(error.message)) {
    return 'El registro está cerrado. Solo se entra por invitación.';
  }
  if (error.code === 'user_already_exists' || /already registered/i.test(error.message)) {
    return 'Ese correo ya tiene cuenta. Entra con él o recupera la contraseña.';
  }
  if (error.code === 'over_email_send_rate_limit' || /rate limit/i.test(error.message)) {
    return 'Se han enviado demasiados correos en poco tiempo. Espera un rato y reinténtalo.';
  }
  if (error.code === 'weak_password') {
    return 'Esa contraseña es demasiado débil. Prueba con una más larga.';
  }
  return error.message;
}

export function SignUpPage() {
  const { status } = useAuth();
  const settings = useAuthSettings();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  if (status === 'signed-in') return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD) {
      setError(`La contraseña necesita al menos ${MIN_PASSWORD} caracteres`);
      return;
    }
    setBusy(true);
    setError(null);
    const { error: signUpError } = await getSupabase().auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: fullName.trim() || null } },
    });
    setBusy(false);
    if (signUpError) {
      setError(describeSignUpError(signUpError));
      return;
    }
    setDone(true);
  }

  // El registro abierto se apaga desde el panel de Supabase. Si está
  // cerrado, esta pantalla no puede funcionar: mejor explicarlo que dejar
  // que alguien rellene el formulario y se estrelle contra el error.
  if (settings && !settings.signupEnabled) {
    return (
      <AuthLayout
        title="Solo por invitación"
        subtitle="Esta aplicación no admite altas abiertas."
        footer={<Link to="/login">Volver a entrar</Link>}
      >
        <p className="adm-muted">
          Para tener acceso, pide a quien dirija tu empresa que te invite con tu correo. Recibirás
          un enlace para elegir tu propia contraseña.
        </p>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout
        title="Revisa tu correo"
        subtitle={`Hemos enviado un enlace de confirmación a ${email}.`}
        footer={<Link to="/login">Volver a entrar</Link>}
      >
        <p className="adm-muted">
          Al confirmar tendrás cuenta, pero todavía no acceso a ninguna empresa. Quien dirija tu
          empresa tiene que invitarte para que puedas levantar reportes.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Crear cuenta"
      subtitle="Si te han invitado, usa el enlace del correo en vez de este formulario."
      footer={<Link to="/login">Ya tengo cuenta</Link>}
    >
      <form className="adm-form" onSubmit={handleSubmit}>
        <label className="adm-field">
          <span>Nombre</span>
          <input
            value={fullName}
            autoComplete="name"
            onChange={(e) => setFullName(e.target.value)}
          />
        </label>
        <label className="adm-field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            autoComplete="email"
            required
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
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
        {error && <p className="adm-error">{error}</p>}
        <button className="adm-btn adm-btn-primary" type="submit" disabled={busy}>
          {busy ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>
    </AuthLayout>
  );
}
