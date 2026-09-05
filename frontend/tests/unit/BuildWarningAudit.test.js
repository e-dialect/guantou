import { describe, expect, it } from 'vitest';

import { auditBuildOutput } from '../../scripts/build-with-warning-audit.mjs';

describe('frontend build warning audit', () => {
  it('rejects static and dynamic imports that cannot split into chunks', () => {
    const output = [
      '[plugin:vite:reporter]',
      '(!) /repo/src/services/themeApi.js is dynamically imported by /repo/src/services/themeFault.js but also statically imported by /repo/src/App.vue, dynamic import will not move module into another chunk.',
    ].join('\n');

    expect(auditBuildOutput(output, 'h5')).toEqual({
      allowed: [],
      violations: [output.split('\n')[1]],
    });
  });

  it('rejects toolchain updates, project Sass, and stale browser-data warnings', () => {
    const output = [
      'uni-app 有新版本发布，请按兼容矩阵升级',
      'DEPRECATION WARNING [import]: Sass @import rules are deprecated',
      'Browserslist: browsers data (caniuse-lite) is 9 months old',
    ].join('\n');

    expect(auditBuildOutput(output, 'h5').violations).toHaveLength(3);
  });

  it('does not deduplicate repeated chunk warnings', () => {
    const known = '(!) /repo/src/services/themeCenter.js is dynamically imported by a.js but also statically imported by b.js, dynamic import will not move module into another chunk.';
    const unknown = '(!) /repo/src/services/newFeature.js is dynamically imported by a.js but also statically imported by b.js, dynamic import will not move module into another chunk.';
    const audit = auditBuildOutput([known, known, unknown].join('\n'), 'h5');

    expect(audit.allowed).toEqual([]);
    expect(audit.violations).toEqual([known, known, unknown]);
  });

  it('does not allow H5-only chunk warnings in mini-program builds', () => {
    const output = '(!) /repo/src/services/themeSchema.js is dynamically imported by a.js but also statically imported by b.js, dynamic import will not move module into another chunk.';

    expect(auditBuildOutput(output, 'mp-weixin').violations).toEqual([output]);
  });
});
