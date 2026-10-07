import { VitePWA } from 'vite-plugin-pwa'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'
import { criticalRoutePreload } from './scripts/critical-route-preload.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    criticalRoutePreload(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      // Protected hosting requires the browser session when fetching the manifest.
      useCredentials: true,
      includeAssets: [
        'favicon.svg',
        'favicon.ico',
        'icons/*.png',
        'icons/atlas.svg',
      ],
      manifest: {
        id: '/',
        name: 'Atlas',
        short_name: 'Atlas',
        description:
          'Seu espaço pessoal para tarefas, hábitos, estudos e projetos.',
        lang: 'pt-BR',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#141414',
        background_color: '#141414',
        categories: ['productivity', 'education'],
        icons: [
          {
            src: '/icons/atlas-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/atlas-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/atlas-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          { name: 'Hoje', short_name: 'Hoje', url: '/' },
          { name: 'Tarefas', short_name: 'Tarefas', url: '/tarefas' },
          { name: 'Notas', short_name: 'Notas', url: '/notas' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico,png,webmanifest}'],
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        clientsClaim: true,
        skipWaiting: false,
      },
      devOptions: { enabled: false },
    }),
  ],
  preview: { headers: { 'Cache-Control': 'no-cache' } },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'storage',
              test: /node_modules[\\/]dexie[\\/]/,
              priority: 30,
            },
            {
              name: 'validation',
              test: /node_modules[\\/]zod[\\/]/,
              priority: 30,
            },
            {
              name: 'react-core',
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/,
              priority: 25,
            },
            { name: 'initial', tags: ['$initial'], priority: 20 },
            // Keep the landing route's static dependencies together. Tiny shared
            // chunks previously queued dozens of requests on a cold mobile visit.
            // Dynamic imports (profile, previews, table, picker) remain separate.
            {
              name: 'today',
              test: /src[\\/]features[\\/]today[\\/]TodayPage\.tsx$/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
  test: {
    // Serialize jsdom cold imports on this Windows runner. Parallel workers
    // can stall lazy-module preparation; keep assertion/time limits unchanged.
    maxWorkers: 1,
    execArgv: ['--no-experimental-webstorage'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    clearMocks: true,
  },
})
