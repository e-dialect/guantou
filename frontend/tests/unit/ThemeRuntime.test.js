import { describe, expect, it, vi } from 'vitest';

import {
  bindThemeRuntimeAdapters,
  themeRuntime,
} from '@/services/themeRuntime';

describe('theme runtime adapters', () => {
  it('binds adapters with a scoped restore', () => {
    const previous = themeRuntime().getActiveThemeId();
    const restore = bindThemeRuntimeAdapters({
      getActiveThemeId: () => 'paper',
    });

    expect(themeRuntime().getActiveThemeId()).toBe('paper');
    restore();
    expect(themeRuntime().getActiveThemeId()).toBe(previous);
  });

  it('rejects unknown or non-callable adapters', () => {
    expect(() => bindThemeRuntimeAdapters({ typo: vi.fn() }))
      .toThrow('Unknown theme runtime adapter: typo');
    expect(() => bindThemeRuntimeAdapters({ getActiveThemeId: 'paper' }))
      .toThrow('Theme runtime adapter getActiveThemeId must be a function');
  });
});
