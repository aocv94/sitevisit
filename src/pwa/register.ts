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
