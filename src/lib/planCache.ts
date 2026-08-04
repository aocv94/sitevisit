import { signedPlanUrl } from '@/api/plans';

/**
 * Cache local de las laminas de plano.
 *
 * El bucket es privado, asi que cada lamina se sirve con una URL firmada que
 * caduca y que cambia en cada firma. Eso la hace inservible como clave de
 * cache y, sobre todo, deja la app inutil sin señal: en obra no se puede
 * pedir una firma nueva.
 *
 * Asi que la lamina se descarga UNA vez y se guarda por `storage_path`, que
 * si es estable. Y como cada subida genera una ruta nueva (ver uploadPlan),
 * reemplazar un plano invalida su entrada sola: no hay forma de quedarse
 * mirando la revision vieja.
 */
const CACHE_NAME = 'svr-plans-v1';

/** storage_path -> object URL vivo, para no recrearlo en cada render. */
const objectUrls = new Map<string, string>();

function cacheKey(storagePath: string): string {
  return `${location.origin}/__plan__/${encodeURIComponent(storagePath)}`;
}

async function openCache(): Promise<Cache | null> {
  // Cache Storage exige contexto seguro. Sin el, la app sigue funcionando
  // con conexion; solo pierde el modo offline.
  if (typeof caches === 'undefined') return null;
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

async function readBlob(storagePath: string): Promise<Blob | null> {
  const cache = await openCache();
  if (!cache) return null;
  const hit = await cache.match(cacheKey(storagePath));
  return hit ? await hit.blob() : null;
}

async function writeBlob(storagePath: string, blob: Blob): Promise<void> {
  const cache = await openCache();
  if (!cache) return;
  try {
    await cache.put(
      cacheKey(storagePath),
      new Response(blob, { headers: { 'Content-Type': blob.type || 'image/jpeg' } })
    );
  } catch {
    // Cuota llena. No es motivo para impedir trabajar: se sigue online.
  }
}

/** URL utilizable en un <img> o en `new Image()`. Sale de cache si esta. */
export async function planImageUrl(storagePath: string): Promise<string> {
  const live = objectUrls.get(storagePath);
  if (live) return live;

  let blob = await readBlob(storagePath);
  if (!blob) {
    const signed = await signedPlanUrl(storagePath);
    const response = await fetch(signed);
    if (!response.ok) throw new Error(`No se pudo descargar la lámina (${response.status})`);
    blob = await response.blob();
    await writeBlob(storagePath, blob);
  }

  const url = URL.createObjectURL(blob);
  objectUrls.set(storagePath, url);
  return url;
}

/**
 * Baja las laminas del proyecto por adelantado. Se llama al entrar a
 * capturar, con conexion, para que despues funcionen sin ella. Los fallos
 * se tragan: es mejor entrar con tres de cuatro planos que no entrar.
 */
export async function prefetchPlans(storagePaths: readonly string[]): Promise<void> {
  await Promise.all(
    storagePaths.map(async (path) => {
      try {
        await planImageUrl(path);
      } catch {
        // Se reintentara cuando alguien abra esa lamina.
      }
    })
  );
}

/** Se llama al borrar o reemplazar una lamina, para no dejar bytes muertos. */
export async function forgetPlan(storagePath: string): Promise<void> {
  const live = objectUrls.get(storagePath);
  if (live) {
    URL.revokeObjectURL(live);
    objectUrls.delete(storagePath);
  }
  const cache = await openCache();
  await cache?.delete(cacheKey(storagePath));
}

/** Cuántas láminas hay descargadas. Sirve para avisar antes de ir a obra. */
export async function cachedPlanCount(): Promise<number> {
  const cache = await openCache();
  if (!cache) return 0;
  return (await cache.keys()).length;
}
