/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Bunkar MVP — Hindi-first offline PWA. Dev proxy: /api → API on :8791.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Bunkar',
        short_name: 'Bunkar',
        description: 'Attendance, wages, stock and orders for carpet units — works offline.',
        lang: 'hi',
        dir: 'ltr',
        theme_color: '#0e7c7b',
        background_color: '#f6f5f1',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // The Excel library (~930 KB) is fetched on first export, not precached: keeps the offline shell small.
        globIgnores: ['**/*.woff', '**/xlsx-vendor-*.js'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [{ urlPattern: ({ url }) => url.pathname.startsWith('/api'), handler: 'NetworkOnly' }],
      },
      devOptions: { enabled: false },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react-vendor';
          if (/[\\/]node_modules[\\/]react-router/.test(id)) return 'router-vendor';
          if (/[\\/]node_modules[\\/](dexie|dexie-react-hooks)[\\/]/.test(id)) return 'dexie-vendor';
          if (/[\\/]node_modules[\\/]exceljs[\\/]/.test(id)) return 'xlsx-vendor';
          return undefined;
        },
      },
    },
  },
  // Pre-bundle the lazily imported Excel library so the first export click never triggers a dev reload.
  optimizeDeps: { include: ['exceljs'] },
  server: { proxy: { '/api': { target: process.env.VITE_API_TARGET || 'http://localhost:8791', changeOrigin: true } } },
  preview: { proxy: { '/api': { target: process.env.VITE_API_TARGET || 'http://localhost:8792', changeOrigin: true } } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
