import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AuthLayout } from '@/components/AuthLayout';
import { useAuth } from '@/auth/authContext';
import { getSupabase } from '@/lib/supabase';

const MIN_PASSWORD = 8;

export function SignUpPage() {
  const { status } = useAuth();
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
      setError(signUpError.message);
      return;
    }
    setDone(true);
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
