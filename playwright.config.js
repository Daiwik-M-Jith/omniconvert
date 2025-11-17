/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  timeout: 30 * 1000,
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } }
  ],
  testDir: './tests/e2e'
};

module.exports = config;
