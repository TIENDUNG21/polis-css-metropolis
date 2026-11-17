import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileStyles } from '../../tools/lib/styles.js';
import { BuildError } from '../../tools/lib/errors.js';

/** @param {string} source @param {(file: string) => void} fn */
function withScss(source, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'polis-scss-'));
  try {
    const file = join(dir, 'main.scss');
    writeFileSync(file, source);
    fn(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('compiles to compressed CSS', () => {
  withScss('$a: 2px; .x { margin: $a * 2; }', (file) => {
    assert.equal(compileStyles(file).css, '.x{margin:4px}\n');
  });
});

test('a Sass error becomes a BuildError with the position', () => {
  withScss('.x {\n  margin: $missing;\n}', (file) => {
    assert.throws(
      () => compileStyles(file),
      (/** @type {unknown} */ err) => err instanceof BuildError && err.line === 2 && /Undefined variable/.test(err.reason),
    );
  });
});

test('any Sass warning fails the build, deprecations included', () => {
  withScss('@use "sass:math";\n$w: 10px;\n.x { a: math.div(1, 1); b: (4px / $w); }', (file) => {
    assert.throws(() => compileStyles(file), /Sass warning: .*division/i);
  });
  withScss('.x { @warn "careful"; }', (file) => {
    assert.throws(() => compileStyles(file), /Sass warning: careful/);
  });
});
