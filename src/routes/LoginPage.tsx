import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import type { AuthError } from '@supabase/supabase-js';
import { AuthLayout } from '@/components/AuthLayout';
import { useAuth } from '@/auth/authContext';
import { getSupabase } from '@/lib/supabase';

/**
 * Un fallo de red no es una contraseña mal puesta.
 *
 * Esta app se usa en obra, donde quedarse sin cobertura es lo normal. Decirle
 * a alguien que su contraseña es incorrecta cuando lo que pasa es que no hay
 * señal le manda a resetearla para nada.
 */
function describeSignInError(error: AuthError): string {
  if (error.code === 'invalid_credentials' || error.status === 400) {
    // Supabase no distingue "no existe" de "contraseña incorrecta", y hace
    // bien: distinguirlo permitiría averiguar quién tiene cuenta.
    return 'Email o contraseña incorrectos';
  }
  if (error.code === 'email_not_confirmed') {
    return 'Confirma tu email antes de entrar: busca el correo que te enviamos.';
  }
  if (error.code === 'over_request_rate_limit') {
    return 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.';
  }
  // status 0 = la petición no llegó a salir.
  if (!error.status || error.name === 'AuthRetryableFetchError') {
    return 'No se pudo contactar con el servidor. Comprueba la conexión.';
  }
  return error.message;
}

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
      setError(describeSignInError(signInError));
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
