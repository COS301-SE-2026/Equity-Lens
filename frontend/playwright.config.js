import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',

  //this will be used for all the pages
  use: {
    baseURL: 'http://localhost:5173',
  },

  //what to do before the test
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
  },
});