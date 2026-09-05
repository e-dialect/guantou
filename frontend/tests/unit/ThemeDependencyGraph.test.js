import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../src');
const serviceNames = [
  'themeAnalytics',
  'themeAnalyticsLabels',
  'themeApi',
  'themeCenter',
  'themeFault',
  'themeRuntime',
  'themeSchema',
  'themeStatus',
];
const sources = Object.fromEntries(serviceNames.map((name) => [
  name,
  readFileSync(resolve(root, 'services', `${name}.js`), 'utf8'),
]));
const themeServiceNamePattern = 'theme(?:AnalyticsLabels|Analytics|Api|Center|Fault|Runtime|Schema|Status)';

function themeServiceImports(source) {
  const importPattern = new RegExp(
    `from\\s+['"](?:@/services/|\\./)(${themeServiceNamePattern})(?:\\.js)?['"]`,
    'g',
  );
  return [...source.matchAll(importPattern)].map((match) => match[1]);
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

describe('theme service dependency graph', () => {
  it('has no reverse dynamic imports between theme services', () => {
    const dynamicImportPattern = new RegExp(
      `import\\(['"](?:@/services/|\\./)(${themeServiceNamePattern})(?:\\.js)?['"]\\)`,
      'g',
    );
    const matches = Object.entries(sources).flatMap(([name, source]) => (
      [...source.matchAll(dynamicImportPattern)].map((match) => `${name} -> ${match[1]}`)
    ));
    expect(matches).toEqual([]);
  });

  it('keeps the static theme-service graph acyclic', () => {
    const graph = Object.fromEntries(
      Object.entries(sources).map(([name, source]) => [name, themeServiceImports(source)]),
    );
    expect(dependencyCycles(graph)).toEqual([]);
  });
});
