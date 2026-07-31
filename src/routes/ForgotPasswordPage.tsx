import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AuthLayout } from '@/components/AuthLayout';
import { appOrigin, getSupabase } from '@/lib/supabase';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    await getSupabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${appOrigin()}/aceptar-invitacion`,
    });
    setBusy(false);
    // Se confirma siempre, exista o no la cuenta: si dijeramos "ese email no
    // esta registrado" cualquiera podria averiguar quien tiene cuenta.
    setSent(true);
  }

  if (sent) {
    return (
      <AuthLayout
        title="Revisa tu correo"
        subtitle={`Si ${email} tiene cuenta, le llegará un enlace para elegir una contraseña nueva.`}
        footer={<Link to="/login">Volver a entrar</Link>}
      >
        <p className="adm-muted">El enlace caduca en una hora.</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Recuperar contraseña" footer={<Link to="/login">Volver a entrar</Link>}>
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
        <button className="adm-btn adm-btn-primary" type="submit" disabled={busy}>
          {busy ? 'Enviando…' : 'Enviar enlace'}
        </button>
      </form>
    </AuthLayout>
  );
}
