import { defineConfig } from '@playwright/test'
const baseURL = process.env.ATLAS_TEST_URL ?? 'http://127.0.0.1:4180'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  use: {
    baseURL,
    browserName: 'chromium',
    channel: 'msedge',
  },
  webServer: process.env.ATLAS_TEST_URL
    ? undefined
    : {
        command:
          'npm run build && npm run preview -- --host 127.0.0.1 --port 4180 --strictPort',
        url: 'http://127.0.0.1:4180',
        reuseExistingServer: true,
      },
})
