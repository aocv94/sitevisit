import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json' with { type: 'json' };

/**
 * Etiqueta de build que se muestra bajo el titulo en la app. Sirve para
 * confirmar en campo que version trae el telefono, igual que la constante
 * BUILD del index.html original - pero ya no hay que acordarse de subirla
 * a mano en cada deploy.
 */
const buildId = `${pkg.version}+${new Date().toISOString().slice(0, 10)}`;

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // injectManifest, no generateSW: la politica de caching de esta app es
      // deliberada (ver src/sw.ts) y no coincide con los defaults de Workbox.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // El registro se hace a mano en src/pwa/register.ts para conservar el
      // reg.update() en visibilitychange del service worker original.
      injectRegister: null,
      registerType: 'autoUpdate',
      injectManifest: {
        // Los planos entran al precache desde public/ automaticamente. Antes
        // habia que mantener la lista a mano en index.html Y en sw.js.
        globPatterns: ['**/*.{js,css,html,webmanifest,jpg,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Worker clasico, no modulo ES. Los service workers de tipo modulo
        // no llegan a todos los Safari de iOS, y esta app se usa desde el
        // telefono: si el worker no arranca, no hay modo offline.
        rollupFormat: 'iife',
      },
      manifest: {
        name: 'Constellation Site Visit Report',
        short_name: 'Site Visit',
        start_url: './index.html',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f5f4f1',
        theme_color: '#14202b',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: {
        enabled: false,
        type: 'module',
      },
    }),
  ],
  define: {
    __APP_BUILD__: JSON.stringify(buildId),
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
