import { getSupabase } from '@/lib/supabase';
import type { PlanRow } from '@/types/db';

export const MEDIA_BUCKET = 'visit-media';

const COLUMNS = 'id, project_id, code, label, storage_path, sort';

export async function listPlans(projectId: string): Promise<PlanRow[]> {
  const { data, error } = await getSupabase()
    .from('plans')
    .select(COLUMNS)
    .eq('project_id', projectId)
    .order('sort', { ascending: true })
    .order('code', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PlanRow[];
}

/**
 * La ruta es el contrato con las policies de Storage: la primera carpeta es
 * la empresa y la segunda el proyecto, y de ahi salen los permisos. Cambiar
 * este formato sin cambiar `project_from_path` abre el bucket.
 *
 * El sufijo aleatorio no es decorativo. Si una revision del plano se
 * guardase en la MISMA ruta, la copia cacheada en el telefono seguiria
 * sirviendo la lamina vieja: el problema clasico de "sigo viendo el plano
 * antiguo". Con ruta nueva, la cache local (indexada por storage_path)
 * queda invalidada sola.
 */
function storagePath(orgId: string, projectId: string, code: string, fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase() || 'jpg';
  const safeCode = code.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
  const version = Date.now().toString(36);
  return `${orgId}/${projectId}/${safeCode}-${version}.${extension}`;
}

export interface UploadPlanInput {
  orgId: string;
  projectId: string;
  /** Codigo de lamina: '101', '103a'. Unico dentro del proyecto. */
  code: string;
  label: string;
  file: File;
  sort?: number;
}

export async function uploadPlan(input: UploadPlanInput): Promise<PlanRow> {
  const supabase = getSupabase();
  const code = input.code.trim();
  const path = storagePath(input.orgId, input.projectId, code, input.file.name);

  // Subir una lamina con un codigo que ya existe la REEMPLAZA. Es lo que se
  // quiere cuando llega una revision del plano, y los pines ya colocados
  // siguen valiendo porque se guardan normalizados 0-1, no en pixeles.
  const { data: previous } = await supabase
    .from('plans')
    .select('id, storage_path')
    .eq('project_id', input.projectId)
    .eq('code', code)
    .maybeSingle();

  const { error: uploadError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, input.file, { contentType: input.file.type });
  if (uploadError) throw new Error(`No se pudo subir el archivo: ${uploadError.message}`);

  const { data, error } = await supabase
    .from('plans')
    .upsert(
      {
        project_id: input.projectId,
        code,
        label: input.label.trim() || code,
        storage_path: path,
        sort: input.sort ?? 0,
      },
      { onConflict: 'project_id,code' }
    )
    .select(COLUMNS)
    .single();

  if (error) {
    // El archivo ya esta arriba pero la fila no: sin fila la lamina es
    // invisible, asi que se limpia en vez de dejar basura en el bucket.
    await supabase.storage.from(MEDIA_BUCKET).remove([path]);
    throw new Error(error.message);
  }

  // La version anterior ya no la referencia nadie.
  if (previous?.storage_path && previous.storage_path !== path) {
    await supabase.storage.from(MEDIA_BUCKET).remove([previous.storage_path]);
  }
  return data as PlanRow;
}

export async function updatePlan(
  id: string,
  patch: Partial<Pick<PlanRow, 'label' | 'sort'>>
): Promise<void> {
  const { error } = await getSupabase().from('plans').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deletePlan(plan: PlanRow): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('plans').delete().eq('id', plan.id);
  if (error) throw new Error(error.message);
  // Si esto falla queda un archivo suelto sin fila. Es ruido, no un fallo
  // de seguridad: sin fila nadie llega a el desde la aplicacion.
  await supabase.storage.from(MEDIA_BUCKET).remove([plan.storage_path]);
}

/**
 * URL temporal para descargar una lamina. El bucket es privado, asi que no
 * hay URL publica estable: cada firma genera una distinta y caduca.
 *
 * Por eso la cache local NO se puede indexar por esta URL. Ver
 * src/lib/planCache.ts.
 */
export async function signedPlanUrl(storagePath: string, seconds = 3600): Promise<string> {
  const { data, error } = await getSupabase()
    .storage.from(MEDIA_BUCKET)
    .createSignedUrl(storagePath, seconds);
  if (error || !data) throw new Error(error?.message ?? 'No se pudo firmar la URL');
  return data.signedUrl;
}
