/// <reference lib="webworker" />
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

/**
 * Service worker: la app abre sin señal y un deploy nuevo llega solo.
 *
 * Dos politicas, a proposito distintas:
 *
 *   Navegacion  -> network-first con timeout de 2.5s.
 *     Se intenta la red para recoger el ultimo deploy, pero se abandona
 *     rapido y se sirve lo cacheado. Un sotano con una barra de señal es
 *     peor que ninguna barra: sin el timeout, la app se queda colgada
 *     esperando una respuesta que no llega.
 *
 *   Todo lo demas -> cache-first.
 *     Codigo, planos y fuentes salen de cache. Abrir es instantaneo.
 *
 * Los assets con hash en el nombre entran al precache desde el manifiesto
 * que inyecta Vite.
 *
 * Las laminas de plano NO pasan por aqui. Antes eran 15 JPEG commiteados que
 * se precacheaban con la app, iguales para todas las empresas; ahora cada
 * proyecto tiene los suyos en Storage y se guardan aparte, por proyecto, en
 * src/lib/planCache.ts. Meterlos en este precache obligaria a cada telefono
 * a descargar los planos de obras en las que no trabaja.
 *
 * La otra mitad de esta politica son las cabeceras HTTP de vercel.json. Se
 * leen juntas: si /sw.js se cachea, un telefono con la PWA instalada se queda
 * clavado en la version vieja para siempre, porque este fichero es el UNICO
 * camino por el que le llega un deploy.
 */

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

const RUNTIME_CACHE = 'svr-runtime-v1';
const NETWORK_TIMEOUT_MS = 2500;
const INDEX_URL = '/index.html';

/** Cache de la version anterior, escrita a mano. Se borra al activar. */
const LEGACY_CACHES = ['svr-v1'];

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

self.addEventListener('install', () => {
  // Sin esperar: la version nueva toma el control en cuanto esta lista.
  void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await Promise.all(LEGACY_CACHES.map((name) => caches.delete(name)));
      await self.clients.claim();
    })()
  );
});

function fetchWithTimeout(request: Request, ms: number): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('network timeout')), ms);
    fetch(request).then(
      (response) => {
        clearTimeout(timer);
        resolve(response);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    );
  });
}

/** Navegacion: red con timeout corto, luego cache, luego el shell precacheado. */
registerRoute(
  new NavigationRoute(async ({ request }) => {
    const cache = await caches.open(RUNTIME_CACHE);
    try {
      const response = await fetchWithTimeout(request, NETWORK_TIMEOUT_MS);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch {
      const cached = await cache.match(request);
      if (cached) return cached;
      const shell = await matchPrecache(INDEX_URL);
      if (shell) return shell;
      return Response.error();
    }
  })
);

/** Mismo origen y fuera del precache: cache-first. */
registerRoute(
  ({ url, request }) => request.method === 'GET' && url.origin === self.location.origin,
  async ({ request }) => {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      await cache.put(request, response.clone());
    }
    return response;
  }
);

/** Externo (las fuentes de Google): red, y si falla lo que hubiera en cache. */
registerRoute(
  ({ url, request }) => request.method === 'GET' && url.origin !== self.location.origin,
  async ({ request }) => {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) return cached;
      throw error;
    }
  }
);
