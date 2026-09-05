import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const page = readFileSync(resolve(frontendRoot, 'src/pages/users/theme-center.vue'), 'utf8');
const controller = readFileSync(
  resolve(frontendRoot, 'src/pages/users/theme-center/controller.js'),
  'utf8',
);
const style = readFileSync(
  resolve(frontendRoot, 'src/components/theme-center/theme-center.scss'),
  'utf8',
);

const viewNames = [
  'ThemeCenterDiscoveryView',
  'ThemeCenterRecentView',
  'ThemeCenterGlobalView',
  'ThemeCenterLocalView',
  'ThemeCenterFavoritesView',
  'ThemeCenterMineView',
  'ThemeCenterThemeDetail',
  'ThemeCenterFilterSheet',
  'ThemeCenterOutfitSheet',
  'ThemeCenterMergeSheet',
];
const viewSources = Object.fromEntries(viewNames.map((name) => [
  name,
  readFileSync(resolve(frontendRoot, `src/components/theme-center/${name}.vue`), 'utf8'),
]));

function kebabCase(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

describe('theme center page boundary', () => {
  it('keeps the route entry as a view orchestrator', () => {
    expect(page.split('\n').length).toBeLessThan(350);
    expect(page).not.toMatch(/from ['"]@\/services\//);
    viewNames.forEach((name) => expect(page).toContain(`<${name}`));
  });

  it('keeps search in the discovery view without a duplicate shell action', () => {
    const discovery = viewSources.ThemeCenterDiscoveryView;

    expect(page).not.toContain('action-text="搜索"');
    expect(page).not.toContain('@action="onSearch"');
    expect(controller).not.toMatch(/\bonSearch\(\)/);
    expect(discovery).toContain('@confirm="$emit(\'submit-search\')"');
    expect(discovery).toContain('@click="$emit(\'submit-search\')"');
  });

  it('keeps business effects in the controller and views out of it', () => {
    expect(controller).toContain("from '@/services/themeCenter'");
    expect(controller).toContain("from '@/services/themeFault'");
    viewNames.forEach((name) => expect(controller).not.toContain(name));
    Object.entries(viewSources).forEach(([name, source]) => {
      expect(source, name).not.toMatch(/from ['"]@\/services\//);
    });
  });

  it('supplies every internal view prop explicitly from the route entry', () => {
    viewNames.forEach((name) => {
      const propBlock = viewSources[name].match(/props:\s*\[([\s\S]*?)\],/);
      expect(propBlock, `${name} props`).toBeTruthy();
      const propNames = [...propBlock[1].matchAll(/'([^']+)'/g)].map((match) => match[1]);
      const tag = page.match(new RegExp(`<${name}([\\s\\S]*?)/>`));
      expect(tag, `${name} usage`).toBeTruthy();
      propNames.forEach((prop) => {
        expect(tag[1], `${name}.${prop}`).toContain(`:${kebabCase(prop)}=`);
      });
    });
  });

  it('namespaces shared view styles so extracted children do not leak globally', () => {
    expect(page).toContain('class="theme-center-page"');
    expect(style.trimStart().startsWith('.theme-center-page {')).toBe(true);
  });
});
