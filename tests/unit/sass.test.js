import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';
import { WORLD } from '../../tools/lib/components.js';

const scssDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'scss');

/** @param {string} source */
const compile = (source) => sass.compileString(source, { loadPaths: [scssDir], style: 'compressed' }).css;

describe('core/functions', () => {
  test('tiles() converts tiles to pixels', () => {
    assert.equal(compile("@use 'core/functions' as f; a { width: f.tiles(3); }"), 'a{width:60px}');
  });

  test('tiles() rejects lengths with a clear message', () => {
    assert.throws(() => compile("@use 'core/functions' as f; a { width: f.tiles(3px); }"), /tiles\(\) expects a unitless number, got 3px/);
  });

  test('tile-var() and height-var() read the HTML custom properties', () => {
    assert.equal(
      compile("@use 'core/functions' as f; a { left: f.tile-var(x); height: f.height-var(); }"),
      'a{left:calc(var(--x)*20px);height:calc(var(--h)*7px)}',
    );
  });
});

describe('core/mixins', () => {
  test('when() scopes rules to a checked radio on the same element', () => {
    const css = compile("@use 'core/mixins' as m; .polis { @include m.when(camera, plan) { --cam-tilt: 0deg; } }");
    assert.equal(css, '.polis:has(input[name=camera][value=plan]:checked){--cam-tilt: 0deg}');
  });
});

describe('tokens', () => {
  test('the world size in Sass matches the component validator', () => {
    const css = compile("@use 'core/tokens' as t; a { --cols: #{t.$world-cols}; --rows: #{t.$world-rows}; }");
    assert.equal(css, `a{--cols: ${WORLD.cols};--rows: ${WORLD.rows}}`);
  });
});
