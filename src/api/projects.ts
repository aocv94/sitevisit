import { getSupabase } from '@/lib/supabase';
import type { Project } from '@/types/db';

const COLUMNS = 'id, org_id, name, zones, created_at';

/**
 * Proyectos en los que quien pregunta puede trabajar, de todas sus empresas.
 *
 * No lleva filtro por usuario a proposito: la policy `project_read` ya
 * devuelve los de un lider y solo los asignados a un colaborador. Filtrar
 * aqui ademas seria duplicar la regla en dos sitios que se desincronizan.
 */
export async function listAccessibleProjects(): Promise<Project[]> {
  const { data, error } = await getSupabase()
    .from('projects')
    .select(COLUMNS)
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Project[];
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
