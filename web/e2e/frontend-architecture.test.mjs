import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const projects = fileURLToPath(new URL('../projects/', import.meta.url));
const app = name => join(projects, name, 'src', 'app');
const asPath = path => relative(projects, path).split(sep).join('/');

function sources(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sources(path) : path.endsWith('.ts') ? [path] : [];
  });
}

const graph = new Map();
const transport = [];
const unresolved = [];
for (const file of ['store', 'admin', 'shared'].flatMap(name => sources(join(projects, name, 'src')))) {
  const path = asPath(file);
  const source = readFileSync(file, 'utf8');
  const found = ts.preProcessFile(source, true, true).importedFiles;
  if (path.includes('/app/features/') && /\bApiClient\b/.test(source)) transport.push(path);
  graph.set(asPath(file), found.flatMap(({ fileName }) => {
    const target = fileName === '@camba/shared' ? join(projects, 'shared', 'src', 'index')
      : fileName.startsWith('.') ? resolve(dirname(file), fileName) : null;
    if (!target) return [];
    const path = [target, target + '.ts', join(target, 'index.ts')]
      .find(path => path.endsWith('.ts') && existsSync(path));
    if (!path && !statSync(target, { throwIfNoEntry: false })?.isFile()) {
      unresolved.push(`${asPath(file)} → ${fileName}`);
    }
    return path ? [asPath(path)] : [];
  }));
}

test('features keep HTTP transport in data-access modules', () => {
  for (const path of transport) {
    assert.ok(path.includes('/data-access/'), `HTTP client outside data access: ${path}`);
  }
});

test('relative imports and lazy route targets resolve', () => {
  assert.deepEqual(unresolved, []);
});

test('support pages and the transactional areas have separate feature owners', () => {
  for (const name of ['contact', 'shipping', 'faq', 'terms', 'privacy', 'home', 'catalog',
    'product', 'cart', 'checkout', 'account', 'orders']) {
    assert.ok(existsSync(join(app('store'), 'features', name)), `Missing Store feature: ${name}`);
  }
  for (const file of ['support-page.ts', 'support-page.html', 'support-page.css']) {
    assert.ok(!existsSync(join(app('store'), 'support', file)), `Legacy page remains: ${file}`);
  }
  for (const name of ['dashboard', 'homepage', 'notices', 'orders', 'products', 'settings']) {
    assert.ok(existsSync(join(app('admin'), 'features', name)), `Missing Admin feature: ${name}`);
  }
});

test('features depend on sibling entry points, not private implementation files', () => {
  const feature = path => /^(?:store|admin)\/src\/app\/features\/([^/]+)\//.exec(path)?.[1];
  for (const [from, targets] of graph) {
    const owner = feature(from);
    if (!owner) continue;
    for (const to of targets) {
      const dependency = feature(to);
      if (!dependency || dependency === owner) continue;
      assert.ok(to.endsWith(`/features/${dependency}/index.ts`),
        `Private cross-feature import: ${from} → ${to}`);
    }
  }
});

test('shared code cannot depend on app internals, and Admin preview uses the Store entry point', () => {
  for (const [from, targets] of graph) {
    for (const to of targets) {
      const left = from.split('/')[0];
      const right = to.split('/')[0];
      if (left === right || right === 'shared') continue;
      const allowedPreview = left === 'admin' && to === 'store/src/app/home-preview.ts';
      assert.ok(allowedPreview, `Unexpected inter-app dependency: ${from} → ${to}`);
    }
  }
});

test('frontend TypeScript has no import cycles', () => {
  const visited = new Set();
  const active = new Set();
  function visit(path) {
    assert.ok(!active.has(path), `Import cycle: ${[...active, path].join(' → ')}`);
    if (visited.has(path)) return;
    active.add(path);
    for (const next of graph.get(path) ?? []) visit(next);
    active.delete(path);
    visited.add(path);
  }
  for (const path of graph.keys()) visit(path);
});
