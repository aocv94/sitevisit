import { AuthLayout } from '@/components/AuthLayout';

/**
 * Lo que se ve al clonar el repo sin `.env`. Es preferible a una pantalla en
 * blanco con un error en consola que no le dice nada a quien acaba de llegar.
 */
export function SetupRequiredPage() {
  return (
    <AuthLayout title="Falta configurar Supabase">
      <p className="adm-muted">
        La aplicación necesita saber contra qué proyecto de Supabase hablar. Crea un archivo{' '}
        <code>.env</code> en la raíz, copiando <code>.env.example</code>:
      </p>
      <pre className="adm-pre">
        {`VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...`}
      </pre>
      <p className="adm-muted">
        Las dos salen del panel de Supabase, en <strong>Project Settings → API</strong>. La{' '}
        <code>anon key</code> es pública por diseño: viaja en el bundle y no concede más permisos de
        los que dejen pasar las políticas RLS. La <code>service_role</code> no debe aparecer nunca
        aquí.
      </p>
      <p className="adm-muted">Después reinicia el servidor: Vite solo lee el .env al arrancar.</p>
    </AuthLayout>
  );
}
