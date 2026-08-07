import { getSupabase } from '@/lib/supabase';
import type { Project } from '@/types/db';

const COLUMNS = 'id, org_id, name, zones, created_at';

interface AccessibleRow extends Project {
  org: { name: string } | { name: string }[] | null;
}

/**
 * Proyectos en los que quien pregunta puede trabajar, de todas sus empresas,
 * con el nombre de la empresa resuelto.
 *
 * La empresa hace falta para el selector: un dueño de la plataforma puede ver
 * obras de varias, y "CORA Merrick Park" a secas no dice de quien es.
 *
 * No lleva filtro por usuario a proposito: la policy `project_read` ya
 * devuelve los de un lider y solo los asignados a un colaborador. Filtrar
 * aqui ademas seria duplicar la regla en dos sitios que se desincronizan.
 */
export async function listAccessibleProjects(): Promise<Project[]> {
  const { data, error } = await getSupabase()
    .from('projects')
    .select(`${COLUMNS}, org:orgs(name)`)
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as AccessibleRow[]).map((row) => {
    const org = Array.isArray(row.org) ? row.org[0] : row.org;
    return {
      id: row.id,
      org_id: row.org_id,
      name: row.name,
      zones: row.zones,
      created_at: row.created_at,
      org_name: org?.name ?? null,
    };
  });
}

export async function listProjects(orgId: string): Promise<Project[]> {
  const { data, error } = await getSupabase()
    .from('projects')
    .select(COLUMNS)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Project[];
}

/**
 * `zones` define tambien el ORDEN en que se agrupan los items en la lista y
 * en el PDF, no solo que zonas se sugieren. Reordenarlas reordena el reporte.
 */
export async function createProject(input: {
  orgId: string;
  name: string;
  zones: string[];
}): Promise<Project> {
  const { data, error } = await getSupabase()
    .from('projects')
    .insert({ org_id: input.orgId, name: input.name.trim(), zones: input.zones })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as Project;
}

export async function updateProject(
  id: string,
  patch: Partial<Pick<Project, 'name' | 'zones'>>
): Promise<Project> {
  const { data, error } = await getSupabase()
    .from('projects')
    .update(patch)
    .eq('id', id)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as Project;
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await getSupabase().from('projects').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Zonas de partida al crear un proyecto. Se editan despues. */
export const DEFAULT_ZONES = [
  'Site / Perimeter',
  'Garage',
  'Lobby',
  'Amenity Deck',
  'Roof',
  'MEP',
  'Landscape',
];
