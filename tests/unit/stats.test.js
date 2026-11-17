import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../../tools/lib/build.js';
import { countElements, countByClass, keyframes, auditKeyframes, registeredProperties, sizes } from '../../tools/lib/stats.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('countElements', () => {
  test('counts start tags only, not comments, end tags or the doctype', () => {
    assert.equal(countElements('<!DOCTYPE html><html><!-- <p> --><body><p>a</p><br><img src=x></body></html>'), 5);
  });

  test('counts elements by class', () => {
    const html = '<div class="a b"></div><span class="b"></span><i class="ab"></i>';
    assert.deepEqual(countByClass(html, ['a', 'b']), { a: 1, b: 2 });
  });
});

describe('keyframes and the animation audit', () => {
  const css =
    '@property --night{syntax:"<number>";inherits:true;initial-value:0}' +
    '@keyframes ok{0%{transform:translate(0);opacity:0}to{offset-distance:100%;--night:1}}' +
    '@keyframes bad{0%,50%{width:1px;--loose:2}to{background-position:0 0}}';

  test('lists the properties each keyframes block animates', () => {
    assert.deepEqual(keyframes(css), [
      { name: 'ok', properties: ['--night', 'offset-distance', 'opacity', 'transform'] },
      { name: 'bad', properties: ['--loose', 'background-position', 'width'] },
    ]);
  });

  test('reports layout/paint properties and unregistered custom properties', () => {
    assert.deepEqual(registeredProperties(css), new Set(['--night']));
    assert.deepEqual(auditKeyframes(css), [
      '@keyframes bad animates --loose, which is not registered with @property',
      '@keyframes bad animates background-position, which needs layout or paint every frame',
      '@keyframes bad animates width, which needs layout or paint every frame',
    ]);
  });

  test('reports unbalanced CSS instead of looping', () => {
    assert.throws(() => keyframes('@keyframes x{0%{opacity:0}'), /unbalanced braces/);
  });
});

describe('the real build', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'polis-stats-'));
  build({ root, outDir });
  const html = readFileSync(join(outDir, 'index.html'), 'utf8');
  const css = readFileSync(join(outDir, 'polis.css'), 'utf8');
  rmSync(outDir, { recursive: true, force: true });

  test('animates only compositor-friendly or registered properties', () => {
    assert.deepEqual(auditKeyframes(css), []);
    assert.ok(keyframes(css).length >= 10);
  });

  test('stays within its size budgets', () => {
    const elements = countElements(html);
    assert.ok(elements <= 1000, `${elements} elements`);
    const { gzip } = sizes(css);
    assert.ok(gzip <= 20 * 1024, `${gzip} bytes of gzipped CSS`);
  });

  test('has the city it claims: buildings, trees, cars, lamps', () => {
    const counts = countByClass(html, ['bldg', 'tree', 'car', 'lamp', 'block']);
    assert.ok((counts.bldg ?? 0) >= 60);
    assert.ok((counts.tree ?? 0) >= 35);
    assert.equal(counts.car, 14);
    assert.equal(counts.block, 6);
    assert.ok((counts.lamp ?? 0) >= 20);
  });
});
