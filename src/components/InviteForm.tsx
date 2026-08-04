import { useState, type FormEvent } from 'react';
import { inviteUser } from '@/api/members';
import { ROLE_LABELS, type OrgRole } from '@/types/db';

interface Props {
  orgId: string;
  /** Roles que quien invita tiene permiso para repartir. */
  allowedRoles: OrgRole[];
  defaultRole: OrgRole;
  onInvited(): void;
}

export function InviteForm({ orgId, allowedRoles, defaultRole, onInvited }: Props) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<OrgRole>(defaultRole);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await inviteUser({ email, orgId, role, fullName: fullName || undefined });
      setNotice(
        result.invited
          ? `Invitación enviada a ${email}. Tiene que abrir el enlace para elegir contraseña.`
          : `${email} ya tenía cuenta: se le ha dado acceso a ${result.orgName}.`
      );
      setEmail('');
      setFullName('');
      onInvited();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo invitar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="adm-inline-form" onSubmit={handleSubmit}>
      <label className="adm-field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          required
          placeholder="persona@empresa.com"
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <label className="adm-field">
        <span>Nombre (opcional)</span>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </label>
      <label className="adm-field">
        <span>Rol</span>
        <select value={role} onChange={(e) => setRole(e.target.value as OrgRole)}>
          {allowedRoles.map((option) => (
            <option key={option} value={option}>
              {ROLE_LABELS[option]}
            </option>
          ))}
        </select>
      </label>
      <button className="adm-btn adm-btn-primary" type="submit" disabled={busy}>
        {busy ? 'Enviando…' : 'Invitar'}
      </button>
      {error && <p className="adm-error adm-inline-msg">{error}</p>}
      {notice && <p className="adm-notice adm-inline-msg">{notice}</p>}
    </form>
  );
}
