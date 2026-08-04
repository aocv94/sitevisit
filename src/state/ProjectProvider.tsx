import { useCallback, useMemo, type ReactNode } from 'react';
import type { PlanRow, Project } from '@/types/db';
import type { PlanPin } from '@/types/report';
import { ProjectContext, type ProjectContextValue } from './projectContext';

interface Props {
  project: Project;
  plans: readonly PlanRow[];
  children: ReactNode;
}

export function ProjectProvider({ project, plans, children }: Props) {
  const byId = useMemo(() => new Map(plans.map((plan) => [plan.id, plan])), [plans]);

  const planById = useCallback(
    (id: string | null | undefined) => (id ? (byId.get(id) ?? null) : null),
    [byId]
  );

  const planLabel = useCallback(
    (pin: Pick<PlanPin, 'id'> | null | undefined) => {
      if (!pin) return '';
      // Si la lámina se borró, se enseña el id en vez de una cadena vacía:
      // el reporte sigue diciendo que había un pin, aunque ya no se pinte.
      return byId.get(pin.id)?.label ?? pin.id;
    },
    [byId]
  );

  const value = useMemo<ProjectContextValue>(
    () => ({ project, zones: project.zones, plans, planById, planLabel }),
    [project, plans, planById, planLabel]
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}
