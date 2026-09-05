import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';
import {
  h5NotFoundRoutePlugin,
  injectH5NotFoundRoute,
} from '../../build/h5NotFoundRoutePlugin';

const originalPlatform = process.env.UNI_PLATFORM;

afterEach(() => {
  if (originalPlatform === undefined) {
    delete process.env.UNI_PLATFORM;
  } else {
    process.env.UNI_PLATFORM = originalPlatform;
  }
});

describe('H5 not-found route plugin', () => {
  it('adds one catch-all redirect after UniApp generates the H5 route registry', () => {
    const transformed = injectH5NotFoundRoute('window.__uniRoutes=[];');

    expect(transformed).toContain("path: '/:pathMatch(.*)*'");
    expect(transformed).toContain("path: '/pages/error/not-found'");
    expect(transformed).toContain('query: { path: to.path }');
    expect(transformed.match(/guantouH5Routes\.push/g)).toHaveLength(1);
  });

  it('only transforms the H5 module that defines the UniApp route registry', () => {
    const plugin = h5NotFoundRoutePlugin();
    process.env.UNI_PLATFORM = 'h5';

    expect(plugin.transform('window.__uniRoutes=[];')).toEqual(
      expect.objectContaining({ map: null }),
    );
    expect(plugin.transform('export default {};')).toBeNull();

    process.env.UNI_PLATFORM = 'mp-weixin';
    expect(plugin.transform('window.__uniRoutes=[];')).toBeNull();
  });

  it('leaves unrelated pages.json transforms untouched', () => {
    expect(injectH5NotFoundRoute('export default {};')).toBeNull();
  });
});
