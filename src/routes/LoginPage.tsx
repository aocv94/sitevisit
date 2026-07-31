import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { AuthLayout } from '@/components/AuthLayout';
import { useAuth } from '@/auth/authContext';
import { getSupabase } from '@/lib/supabase';

export function LoginPage() {
  const { status } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (status === 'signed-in') {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signInError } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      // Supabase no distingue "no existe" de "contraseña incorrecta", y esta
      // bien que no lo haga: decirlo permite averiguar quien tiene cuenta.
      setError('Email o contraseña incorrectos');
      setBusy(false);
    }
    // Con exito no se toca el estado: AuthProvider redirige al recibir la
    // sesion, y este componente ya estara desmontado.
  }

  return (
    <AuthLayout
      title="Entrar"
      subtitle="Reportes de visita de obra"
      footer={
        <>
          <Link to="/recuperar">He olvidado mi contraseña</Link>
          <Link to="/registro">Crear cuenta</Link>
        </>
      }
    >
      <form className="adm-form" onSubmit={handleSubmit}>
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
            autoComplete="current-password"
            required
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="adm-error">{error}</p>}
        <button className="adm-btn adm-btn-primary" type="submit" disabled={busy}>
          {busy ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </AuthLayout>
  );
}
