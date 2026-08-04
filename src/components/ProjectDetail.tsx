import { useCallback, useState, type FormEvent } from 'react';
import { deletePlan, listPlans, uploadPlan } from '@/api/plans';
import { assignToProject, listProjectMembers, removeFromProject } from '@/api/projectMembers';
import { updateProject } from '@/api/projects';
import { useAsyncData } from '@/hooks/useAsyncData';
import { forgetPlan } from '@/lib/planCache';
import type { OrgMember, PlanRow, Project } from '@/types/db';

interface Props {
  project: Project;
  /** Miembros de la empresa, de donde salen los candidatos a asignar. */
  orgMembers: readonly OrgMember[];
  onProjectChanged(): void;
}

export function ProjectDetail({ project, orgMembers, onProjectChanged }: Props) {
  return (
    <>
      <section className="adm-section">
        <h2>Zonas de {project.name}</h2>
        <ZonesEditor project={project} onSaved={onProjectChanged} />
      </section>

      <section className="adm-section">
        <h2>Planos</h2>
        <PlansManager project={project} />
      </section>

      <section className="adm-section">
        <h2>Quién trabaja en esta obra</h2>
        <AssignmentManager project={project} orgMembers={orgMembers} />
      </section>
    </>
  );
}

function ZonesEditor({ project, onSaved }: { project: Project; onSaved(): void }) {
  const [text, setText] = useState(project.zones.join('\n'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const zones = text
        .split('\n')
        .map((zone) => zone.trim())
        .filter(Boolean);
      await updateProject(project.id, { zones });
      setSaved(true);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron guardar las zonas');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="adm-inline-form adm-inline-form-block" onSubmit={handleSubmit}>
      <label className="adm-field adm-field-wide">
        <span>Una por línea</span>
        <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} />
        <small className="adm-muted">
          Este orden es el que tendrán los apartados del reporte y del PDF. Cambiarlo no toca los
          ítems ya levantados: solo reordena cómo se agrupan.
        </small>
      </label>
      <button className="adm-btn adm-btn-primary" type="submit" disabled={busy}>
        {busy ? 'Guardando…' : 'Guardar zonas'}
      </button>
      {error && <p className="adm-error adm-inline-msg">{error}</p>}
      {saved && !error && <p className="adm-notice adm-inline-msg">Zonas guardadas.</p>}
    </form>
  );
}

function PlansManager({ project }: { project: Project }) {
  const load = useCallback(() => listPlans(project.id), [project.id]);
  const plans = useAsyncData(load, [project.id]);

  async function remove(plan: PlanRow) {
    const ok = window.confirm(
      `¿Borrar la lámina ${plan.label}? Los ítems que la tengan como ubicación conservan su pin, pero ya no se dibujará el key plan en el PDF.`
    );
    if (!ok) return;
    await deletePlan(plan);
    await forgetPlan(plan.storage_path);
    await plans.reload();
  }

  return (
    <>
      <p className="adm-muted">
        Las láminas se descargan al teléfono la primera vez que se abre la obra, para que el plano
        esté disponible sin señal. Subir una lámina con un código que ya existe la reemplaza.
      </p>

      <UploadPlanForm project={project} onUploaded={() => void plans.reload()} />

      {plans.loading && <p className="adm-muted">Cargando…</p>}
      {plans.error && <p className="adm-error">{plans.error}</p>}
      {plans.data && plans.data.length === 0 && (
        <p className="adm-muted">Este proyecto todavía no tiene planos.</p>
      )}
      {plans.data && plans.data.length > 0 && (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Etiqueta</th>
                <th>Orden</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {plans.data.map((plan) => (
                <tr key={plan.id}>
                  <td>
                    <strong>{plan.code}</strong>
                  </td>
                  <td>{plan.label}</td>
                  <td className="adm-muted">{plan.sort}</td>
                  <td className="adm-cell-actions">
                    <button
                      className="adm-linklike adm-danger"
                      type="button"
                      onClick={() => void remove(plan)}
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
    </>
  );
}

function UploadPlanForm({ project, onUploaded }: { project: Project; onUploaded(): void }) {
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [sort, setSort] = useState('0');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setError('Elige un archivo de plano');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await uploadPlan({
        orgId: project.org_id,
        projectId: project.id,
        code,
        label,
        file,
        sort: Number(sort) || 0,
      });
      setCode('');
      setLabel('');
      setFile(null);
      onUploaded();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo subir la lámina');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="adm-inline-form" onSubmit={handleSubmit}>
      <label className="adm-field adm-field-narrow">
        <span>Código</span>
        <input value={code} required placeholder="103a" onChange={(e) => setCode(e.target.value)} />
      </label>
      <label className="adm-field">
        <span>Etiqueta</span>
        <input value={label} placeholder="103A" onChange={(e) => setLabel(e.target.value)} />
      </label>
      <label className="adm-field adm-field-narrow">
        <span>Orden</span>
        <input type="number" value={sort} onChange={(e) => setSort(e.target.value)} />
      </label>
      <label className="adm-field">
        <span>Archivo</span>
        {/* Sin `display:none`: aquí sí queremos el control nativo, a
            diferencia de la pantalla de captura. */}
        <input
          type="file"
          accept="image/*"
          style={{ display: 'block' }}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      <button className="adm-btn adm-btn-primary" type="submit" disabled={busy}>
        {busy ? 'Subiendo…' : 'Subir lámina'}
      </button>
      {error && <p className="adm-error adm-inline-msg">{error}</p>}
    </form>
  );
}

function AssignmentManager({
  project,
  orgMembers,
}: {
  project: Project;
  orgMembers: readonly OrgMember[];
}) {
  const load = useCallback(() => listProjectMembers(project.id), [project.id]);
  const assigned = useAsyncData(load, [project.id]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const assignedIds = new Set((assigned.data ?? []).map((member) => member.user_id));

  async function toggle(userId: string, isAssigned: boolean) {
    setBusyId(userId);
    setActionError(null);
    try {
      if (isAssigned) await removeFromProject(project.id, userId);
      else await assignToProject(project.id, userId);
      await assigned.reload();
    } catch (cause) {
      // Sin esto, un permiso denegado se traga en silencio y el botón
      // simplemente no hace nada: imposible de diagnosticar desde fuera.
      setActionError(cause instanceof Error ? cause.message : 'No se pudo cambiar la asignación');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <p className="adm-muted">
        Solo quien esté marcado aquí verá esta obra y sus planos. Los líderes ven todas las obras de
        la empresa sin necesidad de asignación.
      </p>
      {assigned.loading && <p className="adm-muted">Cargando…</p>}
      {assigned.error && <p className="adm-error">{assigned.error}</p>}
      {actionError && <p className="adm-error">{actionError}</p>}
      {!orgMembers.length && <p className="adm-muted">Esta empresa aún no tiene equipo.</p>}

      {orgMembers.length > 0 && (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Rol en la empresa</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {orgMembers.map((member) => {
                const isLeader = member.role !== 'member';
                const isAssigned = assignedIds.has(member.profile.id);
                return (
                  <tr key={member.profile.id}>
                    <td>
                      <strong>{member.profile.full_name || '—'}</strong>
                      <div className="adm-muted">{member.profile.email}</div>
                    </td>
                    <td>
                      {isLeader ? (
                        <span className="adm-badge adm-badge-ok">Acceso por ser líder</span>
                      ) : isAssigned ? (
                        <span className="adm-badge adm-badge-ok">Asignado</span>
                      ) : (
                        <span className="adm-badge">Sin acceso</span>
                      )}
                    </td>
                    <td className="adm-cell-actions">
                      {!isLeader && (
                        <button
                          className={`adm-linklike${isAssigned ? ' adm-danger' : ''}`}
                          type="button"
                          disabled={busyId === member.profile.id}
                          onClick={() => void toggle(member.profile.id, isAssigned)}
                        >
                          {isAssigned ? 'Quitar de la obra' : 'Asignar'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
