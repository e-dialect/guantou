import {
  afterEach, describe, expect, it, vi,
} from 'vitest';

const originalCI = process.env.CI;

async function loadConfig(ci) {
  if (ci === undefined) {
    delete process.env.CI;
  } else {
    process.env.CI = ci;
  }
  vi.resetModules();
  const { default: config } = await import('../../playwright.config');
  return config;
}

afterEach(() => {
  if (originalCI === undefined) {
    delete process.env.CI;
  } else {
    process.env.CI = originalCI;
  }
  vi.resetModules();
});

describe('Playwright configuration', () => {
  it('uses one worker in CI to avoid concurrent SQLite writes', async () => {
    const config = await loadConfig('true');

    expect(config.workers).toBe(1);
  });

  it('keeps Playwright worker defaults for local runs', async () => {
    const config = await loadConfig(undefined);

    expect(config.workers).toBeUndefined();
  });
});
