import { getSupabase } from '@/lib/supabase';
import type { Profile, ProjectMember } from '@/types/db';

const PROFILE_COLUMNS = 'id, email, full_name, is_app_owner, invited_at, accepted_at, created_at';

interface Row {
  project_id: string;
  user_id: string;
  assigned_at: string;
  profile: Profile | Profile[] | null;
}

export async function listProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const { data, error } = await getSupabase()
    .from('project_members')
    .select(`project_id, user_id, assigned_at, profile:profiles(${PROFILE_COLUMNS})`)
    .eq('project_id', projectId);
  if (error) throw new Error(error.message);

  return ((data ?? []) as unknown as Row[]).flatMap((row) => {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    if (!profile) return [];
    return [
      {
        project_id: row.project_id,
        user_id: row.user_id,
        assigned_at: row.assigned_at,
        profile,
      },
    ];
  });
}

export async function assignToProject(projectId: string, userId: string): Promise<void> {
  // Idempotente: reasignar a alguien que ya esta no debe reventar.
  const { error } = await getSupabase()
    .from('project_members')
    .upsert({ project_id: projectId, user_id: userId }, { onConflict: 'project_id,user_id' });
  if (error) throw new Error(error.message);
}

/**
 * Quita a alguien de la obra. No borra nada de lo que ya observo: los
 * reportes emitidos son el registro de lo que se vio, y no dependen de que
 * su autor siga asignado.
 */
export async function removeFromProject(projectId: string, userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}
