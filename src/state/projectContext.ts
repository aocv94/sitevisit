import { createContext, useContext } from 'react';
import type { PlanRow, Project } from '@/types/db';
import type { PlanPin } from '@/types/report';

/**
 * El proyecto en el que se está capturando, con sus zonas y sus láminas.
 *
 * Antes esto era `src/config/project.ts`: constantes en el código, iguales
 * para todo el mundo. Ahora sale de la base y cambia por empresa y por obra.
 */
export interface ProjectContextValue {
  project: Project;
  /** Orden canónico de agrupación en la lista y en el PDF. */
  zones: readonly string[];
  plans: readonly PlanRow[];
  /** El pin guarda el uuid de la lámina, no su código. */
  planById(id: string | null | undefined): PlanRow | null;
  /** Etiqueta para mostrar. Cae al propio id si la lámina ya no existe. */
  planLabel(pin: Pick<PlanPin, 'id'> | null | undefined): string;
}

export const ProjectContext = createContext<ProjectContextValue | null>(null);

export function useProject(): ProjectContextValue {
  const value = useContext(ProjectContext);
  if (!value) throw new Error('useProject debe usarse dentro de <ProjectProvider>');
  return value;
}
