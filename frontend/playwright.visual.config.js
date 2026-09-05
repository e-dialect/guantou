import { defineConfig } from '@playwright/test';
import baseConfig from './playwright.config';

const baseURL = process.env.VISUAL_REVIEW_BASE_URL || 'http://localhost:8011';
const useExternalServer = process.env.VISUAL_REVIEW_EXTERNAL === '1';

export default defineConfig({
  ...baseConfig,
  testMatch: 'v2-visual-regression.spec.js',
  workers: 1,
  reporter: [['line']],
  use: {
    ...baseConfig.use,
    baseURL,
    viewport: { width: 390, height: 844 },
  },
  webServer: useExternalServer ? undefined : {
    command: 'npm run dev:h5',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
