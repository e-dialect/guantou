import { describe, expect, it } from 'vitest';

import { auditBuildOutput } from '../../scripts/build-with-warning-audit.mjs';

describe('frontend build warning audit', () => {
  it('allows only the known H5 theme chunk warnings', () => {
    const output = [
      '[plugin:vite:reporter]',
      '(!) /repo/src/services/themeApi.js is dynamically imported by /repo/src/services/themeFault.js but also statically imported by /repo/src/App.vue, dynamic import will not move module into another chunk.',
      'uni-app 有新版本发布，请按兼容矩阵升级',
    ].join('\n');

    expect(auditBuildOutput(output, 'h5')).toEqual({
      allowed: [
        { issue: '#328', kind: 'theme-chunk', module: 'themeApi.js' },
        { issue: '#353', kind: 'uni-app-update' },
      ],
      violations: [],
    });
  });

  it('rejects project Sass and stale browser-data warnings', () => {
    const output = [
      'DEPRECATION WARNING [import]: Sass @import rules are deprecated',
      'Browserslist: browsers data (caniuse-lite) is 9 months old',
    ].join('\n');

    expect(auditBuildOutput(output, 'h5').violations).toHaveLength(2);
  });

  it('rejects new dynamic-import warnings and duplicate known warnings', () => {
    const known = '(!) /repo/src/services/themeCenter.js is dynamically imported by a.js but also statically imported by b.js, dynamic import will not move module into another chunk.';
    const unknown = '(!) /repo/src/services/newFeature.js is dynamically imported by a.js but also statically imported by b.js, dynamic import will not move module into another chunk.';
    const audit = auditBuildOutput([known, known, unknown].join('\n'), 'h5');

    expect(audit.allowed).toHaveLength(1);
    expect(audit.violations).toEqual([known, unknown]);
  });

  it('does not allow H5-only chunk warnings in mini-program builds', () => {
    const output = '(!) /repo/src/services/themeSchema.js is dynamically imported by a.js but also statically imported by b.js, dynamic import will not move module into another chunk.';

    expect(auditBuildOutput(output, 'mp-weixin').violations).toEqual([output]);
  });
});
