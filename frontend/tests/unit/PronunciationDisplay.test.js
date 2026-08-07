import { describe, expect, it } from 'vitest';

import { formatPronunciationLabel } from '@/pages/flavors/details.vue';

describe('pronunciation display', () => {
  it('shows base and surface romanization side by side', () => {
    expect(formatPronunciationLabel({
      base_romanization: 'hing5',
      surface_romanization: 'hing2',
      ipa: 'hiŋ²³',
    })).toBe('本调 hing5 → 变调 hing2');
  });

  it('falls back without inventing a missing form', () => {
    expect(formatPronunciationLabel({
      base_romanization: '',
      surface_romanization: 'hing2',
      ipa: 'hiŋ²³',
    })).toBe('hing2');
    expect(formatPronunciationLabel({ ipa: 'hiŋ²³' })).toBe('hiŋ²³');
  });
});
