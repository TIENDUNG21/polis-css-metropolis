import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../../tools/lib/build.js';
import { checkDist } from '../../tools/lib/check-dist.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('the real project builds into HTML + CSS + SVG that pass the dist checker', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'polis-build-'));
  try {
    const report = build({ root, outDir });
    assert.deepEqual(report.files.sort(), ['favicon.svg', 'index.html', 'polis.css']);
    const html = readFileSync(join(outDir, 'index.html'), 'utf8');
    assert.match(html, /^<!DOCTYPE html>/);
    assert.doesNotMatch(html, /@include/);
    assert.match(html, /<link rel="stylesheet" href="polis\.css">/);
    assert.ok(report.cssBytes > 0);
    assert.deepEqual(checkDist(outDir), []);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});
