import { defineConfig } from '@playwright/test'

/**
 * Browser smoke test against a real SPARQL endpoint. It needs a Fuseki with an
 * updatable dataset; FUSEKI_DATASET names it (CI starts one as a service container):
 *
 *   FUSEKI_DATASET=http://localhost:3030/metadata/ npx playwright test
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    // A preinstalled Chromium can be used instead of the one Playwright downloads.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}
  },
  webServer: {
    command: 'npx vite --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
})
