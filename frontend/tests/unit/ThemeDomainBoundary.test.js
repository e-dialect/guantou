import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const servicesRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../src/services');
const files = {
  contracts: 'theme/contracts.js',
  catalogPort: 'theme/catalogPort.js',
  renderPort: 'theme/renderPort.js',
  store: 'theme/store.js',
  catalog: 'theme/catalog.js',
  render: 'theme/render.js',
  sync: 'theme/sync.js',
  facade: 'themeCenter.js',
};
const sources = Object.fromEntries(Object.entries(files).map(([name, file]) => [
  name,
  readFileSync(resolve(servicesRoot, file), 'utf8'),
]));

function domainImports(source) {
  return [...source.matchAll(
    /['"]@\/services\/theme\/(contracts|catalogPort|renderPort|store|catalog|render|sync)['"]/g,
  )].map((match) => match[1]);
}

function dependencyCycles(graph) {
  const visited = new Set();
  const active = [];
  const cycles = [];
  function visit(name) {
    if (active.includes(name)) {
      cycles.push([...active.slice(active.indexOf(name)), name]);
      return;
    }
    if (visited.has(name)) return;
    active.push(name);
    (graph[name] || []).forEach(visit);
    active.pop();
    visited.add(name);
  }
  Object.keys(graph).forEach(visit);
  return cycles;
}

describe('theme domain boundaries', () => {
  it('keeps a single acyclic dependency direction', () => {
    const graph = Object.fromEntries(
      Object.entries(sources).map(([name, source]) => [name, domainImports(source)]),
    );
    expect(dependencyCycles(graph)).toEqual([]);
    expect(graph.store).toEqual([]);
    expect(graph.catalog).toEqual(['catalogPort', 'contracts', 'store']);
    expect(graph.render).toEqual(['catalog', 'store', 'renderPort']);
    expect(graph.sync).toEqual(['catalogPort', 'contracts', 'renderPort', 'store']);
  });

  it('does not hide domain cycles behind dynamic imports', () => {
    const matches = Object.entries(sources).flatMap(([name, source]) => (
      [...source.matchAll(
        /import\(['"]@\/services\/theme\/(contracts|catalogPort|renderPort|store|catalog|render|sync)['"]\)/g,
      )].map((match) => `${name} -> ${match[1]}`)
    ));
    expect(matches).toEqual([]);
  });

  it('keeps catalog data and network code out of the sync test boundary', () => {
    expect(sources.sync).not.toContain("@/services/theme/catalog'");
    expect(sources.sync).not.toContain("@/services/theme/render'");
    expect(sources.sync).toContain("@/services/themeApi'");
    expect(sources.store).not.toContain("@/services/themeApi'");
    expect(sources.catalog).not.toContain("@/services/themeApi'");
    expect(sources.render).not.toContain("@/services/themeApi'");
  });

  it('keeps the compatibility facade thin', () => {
    expect(sources.facade.split('\n').length).toBeLessThan(120);
    expect(sources.facade).not.toMatch(/export function|export const/);
  });

  it('does not expose store implementation helpers through the compatibility facade', () => {
    expect(sources.facade).not.toContain("export * from '@/services/theme/store'");
    [
      'getStoredThemeId',
      'pairKey',
      'readJsonList',
      'readJsonObject',
      'readPairMap',
      'readStorage',
      'scheduleOverlayFlush',
      'writeStorage',
    ].forEach((name) => expect(sources.facade).not.toMatch(new RegExp(`\\b${name}\\b`)));
  });
});
