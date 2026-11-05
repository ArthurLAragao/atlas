import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results/lumen-stage9d',
  testMatch: 'lumen-transfer.spec.ts',
  workers: 1,
  fullyParallel: false,
  timeout: 120_000,
  use: {
    baseURL: 'http://127.0.0.1:4189',
    browserName: 'chromium',
    locale: 'pt-BR',
    channel: 'msedge',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --config vite.lumen-test.config.ts',
    url: 'http://127.0.0.1:4189',
    reuseExistingServer: false,
    env: { VITE_LUMEN_TEST_SESSION: 'stage9d-fictional' },
    timeout: 120_000,
  },
})
