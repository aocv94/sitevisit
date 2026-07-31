import { useCallback, useState, type FormEvent } from 'react';
import { createOrg, listOrgs } from '@/api/orgs';
import { listOrgMembers } from '@/api/members';
import { useAuth } from '@/auth/authContext';
import { InviteForm } from '@/components/InviteForm';
import { MemberTable } from '@/components/MemberTable';
import { Shell } from '@/components/Shell';
import { useAsyncData } from '@/hooks/useAsyncData';
import type { Org, OrgRole } from '@/types/db';

/** El dueño de la app reparte cualquier rol. */
const ALL_ROLES: OrgRole[] = ['owner', 'admin', 'member'];

export function OwnerDashboard() {
  const { session } = useAuth();
  const orgs = useAsyncData(listOrgs, []);
  const [selected, setSelected] = useState<Org | null>(null);

  return (
    <Shell title="Plataforma">
      <section className="adm-section">
        <h2>Nueva empresa</h2>
        <NewOrgForm onCreated={() => void orgs.reload()} />
      </section>

      <section className="adm-section">
        <h2>Empresas</h2>
        {orgs.loading && <p className="adm-muted">Cargando…</p>}
        {orgs.error && <p className="adm-error">{orgs.error}</p>}
        {orgs.data && orgs.data.length === 0 && (
          <p className="adm-muted">Todavía no hay ninguna empresa. Crea la primera arriba.</p>
        )}
        {orgs.data && orgs.data.length > 0 && (
          <ul className="adm-cards">
            {orgs.data.map((org) => (
              <li key={org.id}>
                <button
                  type="button"
                  className={`adm-card${selected?.id === org.id ? ' adm-card-on' : ''}`}
                  onClick={() => setSelected(selected?.id === org.id ? null : org)}
                >
                  <span className="adm-swatch" style={{ background: org.brand_color }} />
                  <strong>{org.name}</strong>
                  <span className="adm-muted">
                    Creada el {new Date(org.created_at).toLocaleDateString()}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <OrgPeople key={selected.id} org={selected} currentUserId={session?.user.id ?? null} />
      )}
    </Shell>
  );
}

function NewOrgForm({ onCreated }: { onCreated(): void }) {
  const [name, setName] = useState('');
  const [brandColor, setBrandColor] = useState('#7ba7af');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createOrg({ name, brandColor });
      setName('');
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear la empresa');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="adm-inline-form" onSubmit={handleSubmit}>
      <label className="adm-field">
        <span>Nombre</span>
        <input
          value={name}
          required
          placeholder="Winmar Construction"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="adm-field adm-field-narrow">
        <span>Color de marca</span>
        <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} />
      </label>
      <button className="adm-btn adm-btn-primary" type="submit" disabled={busy}>
        {busy ? 'Creando…' : 'Crear empresa'}
      </button>
      {error && <p className="adm-error adm-inline-msg">{error}</p>}
    </form>
  );
}

function OrgPeople({ org, currentUserId }: { org: Org; currentUserId: string | null }) {
  const load = useCallback(() => listOrgMembers(org.id), [org.id]);
  const members = useAsyncData(load, [org.id]);

  return (
    <section className="adm-section">
      <h2>Personas de {org.name}</h2>
      <p className="adm-muted">
        Invita aquí a quien vaya a dirigir la empresa. Con el rol de líder podrá crear proyectos e
        invitar a su propio equipo sin pasar por ti.
      </p>
      <InviteForm
        orgId={org.id}
        allowedRoles={ALL_ROLES}
        defaultRole="owner"
        onInvited={() => void members.reload()}
      />
      {members.loading && <p className="adm-muted">Cargando…</p>}
      {members.error && <p className="adm-error">{members.error}</p>}
      {members.data && (
        <MemberTable
          orgId={org.id}
          members={members.data}
          assignableRoles={ALL_ROLES}
          currentUserId={currentUserId}
          onChanged={() => void members.reload()}
        />
      )}
    </section>
  );
}
