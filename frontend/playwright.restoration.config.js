import { defineConfig } from '@playwright/test';
import visual from './playwright.visual.config';
export default defineConfig({ ...visual, testMatch: 'restoration.spec.js', outputDir: 'test-results/restoration' });
