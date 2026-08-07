import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { MembershipWithOrg, Profile } from '@/types/db';

export interface AuthState {
  /** `loading` cubre tambien la restauracion de sesion al arrancar. */
  status: 'loading' | 'signed-out' | 'signed-in';
  session: Session | null;
  profile: Profile | null;
  /** Empresas a las que pertenece, con su papel en cada una. */
  memberships: MembershipWithOrg[];
  /** Crea empresas e invita lideres. Vive por encima de las empresas. */
  isAppOwner: boolean;
  /** Empresas donde puede crear proyectos e invitar. */
  leaderOrgs: MembershipWithOrg[];
  /** Error de carga del perfil, para poder distinguirlo de "no tiene empresa". */
  error: string | null;
  /**
   * Hay una recuperación de contraseña en curso: el enlace del correo acaba
   * de canjearse por una sesión.
   *
   * Se sigue a nivel global y no por ruta porque Supabase no siempre aterriza
   * donde se le pide: si la URL de vuelta no está en su lista de Redirect
   * URLs, cae al Site URL sin avisar. Entonces la persona entra en la app
   * con sesión, sin haber elegido contraseña y sin que nada se lo pida.
   */
  passwordRecovery: boolean;
  clearPasswordRecovery(): void;
  reload(): Promise<void>;
  signOut(): Promise<void>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return value;
}
