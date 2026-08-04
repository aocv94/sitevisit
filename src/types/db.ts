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
