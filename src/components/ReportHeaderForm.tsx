import { useReport } from '@/state/reportContext';
import type { Project } from '@/types/db';

interface Props {
  projects: readonly Project[];
  activeProjectId: string;
  onSelectProject(id: string): void;
}

/**
 * Cabecera del reporte. El proyecto ya no se escribe a mano: se elige, y de
 * él salen las zonas y las láminas. Cada proyecto guarda su propio reporte,
 * así que cambiar aquí cambia la lista entera de abajo.
 */
export function ReportHeaderForm({ projects, activeProjectId, onSelectProject }: Props) {
  const { state, updateHeader } = useReport();

  return (
    <div className="hdr">
      <div>
        <label className="lbl" htmlFor="fProj">
          Project
        </label>
        <select
          id="fProj"
          value={activeProjectId}
          onChange={(e) => onSelectProject(e.target.value)}
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="lbl" htmlFor="fDate">
          Visit date
        </label>
        <input
          id="fDate"
          type="date"
          value={state.date}
          onChange={(e) => updateHeader({ date: e.target.value })}
        />
      </div>
      <div>
        <label className="lbl" htmlFor="fBy">
          Observed by
        </label>
        <input
          id="fBy"
          value={state.by}
          placeholder="Alfonso Orozco"
          onChange={(e) => updateHeader({ by: e.target.value })}
        />
      </div>
      <div>
        <label className="lbl" htmlFor="fRef">
          Report no.
        </label>
        {/* Escribir aquí desactiva la autogeneración a partir de la fecha. */}
        <input
          id="fRef"
          value={state.ref}
          placeholder="SVR-20260721-A"
          onChange={(e) => updateHeader({ ref: e.target.value })}
        />
      </div>
      <div style={{ gridColumn: '1 / -1' }}>
        <label className="lbl" htmlFor="fTo">
          Issued to
        </label>
        <input
          id="fTo"
          value={state.to}
          placeholder="Winmar Construction - Luis Alfonzo"
          onChange={(e) => updateHeader({ to: e.target.value })}
        />
      </div>
    </div>
  );
}
