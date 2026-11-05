import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Unit tests do not need the production PWA/preload/Tailwind build plugins.
// Keeping their lifecycle out of Vitest avoids a Windows collection stall.
export default defineConfig({
  plugins: [react()],
  test: {
    // Windows process-based workers can stall during collection; threads retain isolation.
    pool: 'threads',
    maxWorkers: 1,
    execArgv: ['--no-experimental-webstorage'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    clearMocks: true,
  },
})
