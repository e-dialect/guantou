import { describe, expect, it } from 'vitest';
import {
  visualReviewFaviconLink,
  VISUAL_REVIEW_FAVICON,
} from '../e2e/helpers/visualReviewReport';

describe('visual review report', () => {
  it('uses a self-contained favicon without requesting a site asset', () => {
    const link = visualReviewFaviconLink();

    expect(VISUAL_REVIEW_FAVICON).toMatch(/^data:image\/svg\+xml,/);
    expect(link).toBe(
      `<link rel="icon" type="image/svg+xml" href="${VISUAL_REVIEW_FAVICON}">`,
    );
    expect(link).not.toContain('/favicon.ico');
  });
});
