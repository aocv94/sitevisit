import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Sin claves la app no se cae: enseña la pantalla de configuracion. Esto
 * importa porque el repo se clona sin `.env` y arrancar con una pantalla en
 * blanco y un error en consola no le dice nada a nadie.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

const client: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        // La sesion vive en localStorage y el token se renueva solo. Es lo
        // que permite que la app se abra en obra sin señal: mientras el
        // refresh token siga vigente, la sesion aguanta offline.
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * La anon key es publica por diseño: va en el bundle y no da mas permisos de
 * los que concedan las policies RLS. La service_role NO: esa salta toda la
 * seguridad y solo vive en las Edge Functions.
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    throw new Error(
      'Supabase no está configurado: faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY'
    );
  }
  return client;
}

/** URL base para los enlaces de correo (invitación, reset de contraseña). */
export function appOrigin(): string {
  return window.location.origin;
}
