import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Dealer Quest',
        short_name: 'Dealer Quest',
        description: 'Learn real SQL at Summit Trail RV, a fictional RV dealer group.',
        theme_color: '#2b1d3a',
        background_color: '#1b1428',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache everything, including the DuckDB WASM engine, so the game works offline after first load.
        globPatterns: ['**/*.{js,css,html,png,svg,woff,woff2,wasm}'],
        maximumFileSizeToCacheInBytes: 60 * 1024 * 1024,
        navigateFallback: '/index.html',
      },
    }),
  ],
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['@duckdb/duckdb-wasm'] },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
  },
});
