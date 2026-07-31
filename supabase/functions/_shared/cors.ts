/**
 * El navegador llama a estas funciones desde otro origen, asi que sin CORS
 * ni siquiera llega el preflight.
 *
 * `*` es aceptable aqui porque la funcion no confia en el origen para nada:
 * la autorizacion sale del JWT del header Authorization, que un sitio
 * cualquiera no puede fabricar.
 */
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status);
}
