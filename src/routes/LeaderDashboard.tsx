import { useCallback, useMemo, useState, type FormEvent } from 'react';
import { listOrgMembers } from '@/api/members';
import { listOrgs } from '@/api/orgs';
import { createProject, deleteProject, DEFAULT_ZONES, listProjects } from '@/api/projects';
import { useAuth } from '@/auth/authContext';
import { InviteForm } from '@/components/InviteForm';
import { MemberTable } from '@/components/MemberTable';
import { ProjectDetail } from '@/components/ProjectDetail';
import { Shell } from '@/components/Shell';
import { useAsyncData } from '@/hooks/useAsyncData';
import type { Org, OrgMember, OrgRole, Project } from '@/types/db';

/** Un líder reparte estos dos. Nombrar a otro líder es cosa del dueño de la app. */
const LEADER_ASSIGNABLE: OrgRole[] = ['admin', 'member'];

export function LeaderDashboard() {
  const { leaderOrgs, isAppOwner, session } = useAuth();

  // El dueño de la app puede no ser miembro de ninguna empresa, así que para
  // él se cargan todas; un líder solo ve las suyas.
  const loadOrgs = useCallback(async (): Promise<Org[]> => {
    if (isAppOwner) return listOrgs();
    return leaderOrgs.map((membership) => membership.org);
  }, [isAppOwner, leaderOrgs]);

  const orgs = useAsyncData(loadOrgs, [isAppOwner, leaderOrgs]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);

  const active = useMemo(() => {
    const list = orgs.data ?? [];
    return list.find((org) => org.id === selectedOrgId) ?? list[0] ?? null;
  }, [orgs.data, selectedOrgId]);

  const assignable = isAppOwner
    ? (['owner', ...LEADER_ASSIGNABLE] as OrgRole[])
    : LEADER_ASSIGNABLE;

  return (
    <Shell
      title={active ? active.name : 'Mi empresa'}
      actions={
        orgs.data && orgs.data.length > 1 ? (
          <select
            value={active?.id ?? ''}
            onChange={(event) => setSelectedOrgId(event.target.value)}
            aria-label="Empresa"
          >
            {orgs.data.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        ) : null
      }
    >
      {orgs.loading && <p className="adm-muted">Cargando…</p>}
      {orgs.error && <p className="adm-error">{orgs.error}</p>}
      {!orgs.loading && !active && <p className="adm-muted">No diriges ninguna empresa todavía.</p>}

      {active && (
        <OrgWorkspace
          key={active.id}
          org={active}
          assignableRoles={assignable}
          currentUserId={session?.user.id ?? null}
        />
      )}
    </Shell>
  );
}

function OrgWorkspace({
  org,
  assignableRoles,
  currentUserId,
}: {
  org: Org;
  assignableRoles: OrgRole[];
  currentUserId: string | null;
}) {
  const loadProjects = useCallback(() => listProjects(org.id), [org.id]);
  const projects = useAsyncData(loadProjects, [org.id]);

  // El equipo se carga una vez aquí: lo necesitan la sección de personas y
  // también la de asignación a obra.
  const loadMembers = useCallback(() => listOrgMembers(org.id), [org.id]);
  const members = useAsyncData(loadMembers, [org.id]);

  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const openProject = useMemo(
    () => (projects.data ?? []).find((p) => p.id === openProjectId) ?? null,
    [projects.data, openProjectId]
  );

  async function remove(project: Project) {
    const ok = window.confirm(
      `¿Borrar el proyecto "${project.name}"? Se llevará por delante sus planos y sus reportes.`
    );
    if (!ok) return;
    await deleteProject(project.id);
    if (openProjectId === project.id) setOpenProjectId(null);
    await projects.reload();
  }

  return (
    <>
      <section className="adm-section">
        <h2>Proyectos</h2>
        <NewProjectForm orgId={org.id} onCreated={() => void projects.reload()} />

        {projects.loading && <p className="adm-muted">Cargando…</p>}
        {projects.error && <p className="adm-error">{projects.error}</p>}
        {projects.data && projects.data.length === 0 && (
          <p className="adm-muted">Ningún proyecto todavía.</p>
        )}
        {projects.data && projects.data.length > 0 && (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Proyecto</th>
                  <th>Zonas</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {projects.data.map((project) => (
                  <tr key={project.id}>
                    <td>
                      <button
                        className="adm-linklike"
                        type="button"
                        onClick={() =>
                          setOpenProjectId(openProjectId === project.id ? null : project.id)
                        }
                      >
                        <strong>{project.name}</strong>
                      </button>
                    </td>
                    <td>
                      <span className="adm-muted">
                        {project.zones.length ? project.zones.join(' · ') : 'Sin zonas'}
                      </span>
                    </td>
                    <td className="adm-cell-actions">
                      <button
                        className="adm-linklike adm-danger"
                        type="button"
                        onClick={() => void remove(project)}
                      >
                        Borrar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {openProject && (
        <ProjectDetail
          key={openProject.id}
          project={openProject}
          orgMembers={members.data ?? []}
          onProjectChanged={() => void projects.reload()}
        />
      )}

      <section className="adm-section">
        <h2>Equipo de {org.name}</h2>
        <p className="adm-muted">
          Quien invites recibirá un correo con un enlace para elegir su propia contraseña. Estar en
          la empresa no da acceso a las obras: eso se asigna proyecto por proyecto.
        </p>
        <InviteForm
          orgId={org.id}
          allowedRoles={assignableRoles}
          defaultRole="member"
          onInvited={() => void members.reload()}
        />
        {members.loading && <p className="adm-muted">Cargando…</p>}
        {members.error && <p className="adm-error">{members.error}</p>}
        {members.data && (
          <MemberTable
            orgId={org.id}
            members={members.data as OrgMember[]}
            assignableRoles={assignableRoles}
            currentUserId={currentUserId}
            onChanged={() => void members.reload()}
          />
        )}
      </section>
    </>
  );
}

function NewProjectForm({ orgId, onCreated }: { orgId: string; onCreated(): void }) {
  const [name, setName] = useState('');
  const [zonesText, setZonesText] = useState(DEFAULT_ZONES.join('\n'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const zones = zonesText
        .split('\n')
        .map((zone) => zone.trim())
        .filter(Boolean);
      await createProject({ orgId, name, zones });
      setName('');
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear el proyecto');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="adm-inline-form adm-inline-form-block" onSubmit={handleSubmit}>
      <label className="adm-field">
        <span>Nombre del proyecto</span>
        <input
          value={name}
          required
          placeholder="CORA Merrick Park"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="adm-field adm-field-wide">
        <span>Zonas, una por línea</span>
        <textarea rows={6} value={zonesText} onChange={(e) => setZonesText(e.target.value)} />
        <small className="adm-muted">
          Este orden es el que tendrán los apartados del reporte y del PDF.
        </small>
      </label>
      <button className="adm-btn adm-btn-primary" type="submit" disabled={busy}>
        {busy ? 'Creando…' : 'Crear proyecto'}
      </button>
      {error && <p className="adm-error adm-inline-msg">{error}</p>}
    </form>
  );
}
