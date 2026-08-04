import { getSupabase } from '@/lib/supabase';
import type { Org } from '@/types/db';

const COLUMNS = 'id, name, logo_url, brand_color, disclaimer, created_at';

/**
 * Todas las empresas visibles para quien pregunta. No hace falta filtrar por
 * usuario: la policy `org_read` ya devuelve solo las suyas, o todas si es
 * dueño de la app. La UI no es la que decide quien ve que.
 */
export async function listOrgs(): Promise<Org[]> {
  const { data, error } = await getSupabase()
    .from('orgs')
    .select(COLUMNS)
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Org[];
}

export async function createOrg(input: {
  name: string;
  brandColor?: string;
  disclaimer?: string | null;
}): Promise<Org> {
  const { data, error } = await getSupabase()
    .from('orgs')
    .insert({
      name: input.name.trim(),
      ...(input.brandColor ? { brand_color: input.brandColor } : {}),
      ...(input.disclaimer !== undefined ? { disclaimer: input.disclaimer } : {}),
    })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as Org;
}

export async function updateOrg(
  id: string,
  patch: Partial<Pick<Org, 'name' | 'brand_color' | 'disclaimer' | 'logo_url'>>
): Promise<Org> {
  const { data, error } = await getSupabase()
    .from('orgs')
    .update(patch)
    .eq('id', id)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as Org;
}

export async function deleteOrg(id: string): Promise<void> {
  // En cascada se lleva proyectos, planos, reportes e items de la empresa.
  const { error } = await getSupabase().from('orgs').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
