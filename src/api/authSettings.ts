/**
 * Qué permite la instancia de Supabase en materia de registro.
 *
 * Hace falta porque el registro abierto se activa y se desactiva desde el
 * panel, no desde el código. Sin consultarlo, la app ofrece "Crear cuenta"
 * aunque esté cerrado y el usuario acaba viendo un
 * "Signups not allowed for this instance" en inglés y sin explicación.
 */
export interface AuthSettings {
  /** false si el alta solo puede venir de una invitación. */
  signupEnabled: boolean;
  /** true si hay que confirmar el email antes de poder entrar. */
  emailConfirmationRequired: boolean;
}

const FALLBACK: AuthSettings = { signupEnabled: false, emailConfirmationRequired: true };

/**
 * Una sola petición por carga de página: el ajuste no cambia mientras la
 * pestaña está abierta, y lo consultan varias pantallas.
 */
let inFlight: Promise<AuthSettings> | null = null;

export function fetchAuthSettings(): Promise<AuthSettings> {
  if (inFlight) return inFlight;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  inFlight = (async () => {
    try {
      const response = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anonKey } });
      if (!response.ok) return FALLBACK;
      const body = (await response.json()) as {
        disable_signup?: boolean;
        mailer_autoconfirm?: boolean;
      };
      return {
        signupEnabled: body.disable_signup === false,
        emailConfirmationRequired: body.mailer_autoconfirm === false,
      };
    } catch {
      // Sin red se asume lo más restrictivo: es preferible no ofrecer un
      // registro que quizá no funcione a prometerlo y fallar después.
      return FALLBACK;
    }
  })();

  return inFlight;
}
