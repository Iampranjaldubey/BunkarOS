/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Bunkar OS — Hindi-first offline PWA.
// - Tailwind v4 via the Vite plugin (tokens live in src/index.css @theme).
// - vite-plugin-pwa: autoUpdate SW, offline shell, /api excluded from precache.
// - Dev proxy forwards /api to the zero-dependency Node server on :8787.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Bunkar OS',
        short_name: 'Bunkar',
        description: 'Bhadohi carpet unit manager — offline first.',
        lang: 'hi',
        dir: 'ltr',
        theme_color: '#26406B',
        background_color: '#F4F5F8',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache code/markup/icons + ONLY woff2 fonts. The legacy .woff
        // fallbacks are intentionally excluded (modern Android Chrome supports
        // woff2) to keep the precache small on budget phones. Only the
        // devanagari/latin Mukta + Tiro subsets imported in main.tsx are
        // emitted into dist, so no unused subset is ever precached.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/*.woff'],
        navigateFallback: 'index.html',
        // Never serve the API from the offline cache.
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api'),
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Long-term-cacheable vendor chunks: the big, rarely-changing libraries
        // are split out so an app-code change doesn't bust their cache (and the
        // SW only re-downloads the chunk that actually changed) on repeat visits.
        // Rolldown (Vite 8) requires manualChunks as a function.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react-vendor';
          if (/[\\/]node_modules[\\/]react-router/.test(id)) return 'router-vendor';
          if (/[\\/]node_modules[\\/](dexie|dexie-react-hooks)[\\/]/.test(id)) return 'dexie-vendor';
          return undefined;
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  preview: {
    // The E2E "offline" project serves a production preview on :4173 and runs a
    // throwaway API on :8788; forward /api there. Override with VITE_API_TARGET.
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:8788',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
