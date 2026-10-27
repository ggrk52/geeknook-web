// @ts-check
const { defineConfig } = require('@playwright/test');

/**
 * Playwright configuration for GeekNook E2E audit & regression suite.
 * Targets system Google Chrome with WebGL support enabled.
 */
module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:8080',
    browserName: 'chromium',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    video: 'off',
    screenshot: 'only-on-failure',
    trace: 'off',
    launchOptions: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--use-gl=angle',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
        '--disable-dev-shm-usage',
      ],
    },
  },
  webServer: {
    command: 'python3 -m http.server 8080',
    url: 'http://127.0.0.1:8080/index.html',
    reuseExistingServer: true,
    timeout: 15000,
  },
});
