/**
 * Registro del service worker.
 *
 * Se hace a mano en vez de dejarselo a vite-plugin-pwa para conservar el
 * reg.update() al volver a primer plano: en un telefono la PWA puede pasar
 * dias sin cerrarse, y ese es el momento en que conviene comprobar si hay
 * deploy nuevo.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  // En desarrollo no se genera sw.js, asi que Vite devuelve el index.html y
  // el navegador escupe un error de MIME type en cada carga. Ruido que
  // acaba tapando errores de verdad.
  if (!import.meta.env.PROD) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none', type: 'classic' })
      .then((registration) => {
        void registration.update();
        document.addEventListener('visibilitychange', () => {
          if (!document.hidden && navigator.onLine) void registration.update();
        });
      })
      .catch(() => {
        // Sin service worker la app sigue funcionando online. No molestamos.
      });
  });
}
