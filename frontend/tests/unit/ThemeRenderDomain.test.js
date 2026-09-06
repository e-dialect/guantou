import { describe, expect, it } from 'vitest';
import {
  buildLivePreview,
  themePreviewVars,
} from '@/services/theme/render';

describe('theme render domain', () => {
  it('resolves preview variables without importing network synchronization', () => {
    const theme = {
      id: 'fixture',
      preview: 'paper',
      available: true,
      style_json: { '--theme-page-bg': '#f7f3ea' },
    };
    expect(themePreviewVars(theme)).toMatchObject({
      '--theme-page-bg': '#f7f3ea',
    });
    expect(buildLivePreview({ theme, dressItems: [] })).toMatchObject({
      theme,
      shotClass: ['shot-paper'],
      skipped: [],
      nativeLocked: false,
    });
  });
});
