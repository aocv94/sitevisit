/**
 * Filas tal y como las devuelve Supabase. Nombres en snake_case porque son
 * las columnas: traducirlos aqui solo añadiria una capa que se desincroniza.
 *
 * Cuando el proyecto crezca conviene generarlos con
 * `supabase gen types typescript`, pero a mano son legibles y no obligan a
 * tener la CLI enlazada para compilar.
 */

/** Papel DENTRO de una empresa. El dueño de la app vive fuera de esto. */
export type OrgRole = 'owner' | 'admin' | 'member';

export const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Líder',
  admin: 'Administrador',
  member: 'Colaborador',
};

export interface Org {
  id: string;
  name: string;
  logo_url: string | null;
  brand_color: string;
  disclaimer: string | null;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  is_app_owner: boolean;
  /** No nulo si llegó por invitación. */
  invited_at: string | null;
  /** Nulo mientras no haya fijado su contraseña: invitación pendiente. */
  accepted_at: string | null;
  created_at: string;
}

export interface Membership {
  user_id: string;
  org_id: string;
  role: OrgRole;
}

export interface Project {
  id: string;
  org_id: string;
  name: string;
  zones: string[];
  created_at: string;
  /**
   * Solo lo rellena listAccessibleProjects. Hace falta cuando se listan obras
   * de varias empresas a la vez y el nombre del proyecto no basta para saber
   * de quién es.
   */
  org_name?: string | null;
}

/**
 * Lámina de plano de un proyecto.
 *
 * Ojo con `id` vs `code`: `code` es lo que escribe el líder ('103a') y solo
 * es único dentro de su proyecto; `id` es el uuid y es lo que guarda el pin
 * de un ítem. Renombrar el código no mueve los pines ya colocados.
 */
export interface PlanRow {
  id: string;
  project_id: string;
  code: string;
  label: string;
  /** Ruta en el bucket: `<org_id>/<project_id>/<archivo>`. */
  storage_path: string;
  sort: number;
}

/** Persona asignada a una obra concreta. */
export interface ProjectMember {
  project_id: string;
  user_id: string;
  assigned_at: string;
  profile: Profile;
}

/** Membresía con la empresa ya resuelta, que es como la consume la UI. */
export interface MembershipWithOrg extends Membership {
  org: Org;
}

/** Miembro de una empresa con su perfil, para el listado del líder. */
export interface OrgMember {
  role: OrgRole;
  profile: Profile;
}

/** Un líder es quien puede crear proyectos e invitar dentro de su empresa. */
export function isLeaderRole(role: OrgRole): boolean {
  return role === 'owner' || role === 'admin';
}
