const path = require('path');
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: path.resolve(__dirname, 'tests/e2e'),
  timeout: 60 * 1000,
  use: {
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
});
