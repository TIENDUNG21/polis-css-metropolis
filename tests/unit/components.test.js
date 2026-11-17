import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { expandComponents, COMPONENTS, ROUTES, WORLD } from '../../tools/lib/components.js';
import { BuildError } from '../../tools/lib/errors.js';

/**
 * Asserts that expanding `html` throws a BuildError at line:column whose
 * message matches `pattern`.
 * @param {string} html
 * @param {number} line
 * @param {number} column
 * @param {RegExp} pattern
 */
function assertBuildError(html, line, column, pattern) {
  assert.throws(
    () => expandComponents(html, 'city.html'),
    (/** @type {unknown} */ err) => {
      assert.ok(err instanceof BuildError, `expected BuildError, got ${String(err)}`);
      assert.equal(err.file, 'city.html');
      assert.deepEqual([err.line, err.column], [line, column], err.message);
      assert.match(err.reason, pattern);
      return true;
    },
  );
}

describe('expandComponents: output', () => {
  test('leaves markup without components untouched', () => {
    const html = '<section class="x">\n  <p>Hello</p>\n</section>';
    assert.equal(expandComponents(html, 'a.html'), html);
  });

  test('expands a block with a building into plain HTML with custom properties', () => {
    const out = expandComponents(
      '<polis-block x="1" y="2" w="10" d="8" kind="downtown"><polis-building x="0" y="1" w="3" d="2" h="12" kind="glass"></polis-building></polis-block>',
      'a.html',
    );
    assert.equal(
      out,
      '<div class="block block--downtown" style="--x:1;--y:2;--w:10;--d:8">' +
        '<div class="bldg bldg--glass" style="--x:0;--y:1;--w:3;--d:2;--h:12;--seed:0">' +
        '<span class="bldg__shadow"></span>' +
        '<span class="bldg__wall bldg__wall--s"></span>' +
        '<span class="bldg__wall bldg__wall--e"></span>' +
        '<span class="bldg__wall bldg__wall--w"></span>' +
        '<span class="bldg__roof"></span>' +
        '</div></div>',
    );
  });

  test('accepts self-closing components and keeps the text around them', () => {
    const out = expandComponents('<polis-block x="0" y="0" w="4" d="4" kind="park">\n  <polis-tree x="1.5" y="2"/>\n</polis-block>', 'a.html');
    assert.equal(out, '<div class="block block--park" style="--x:0;--y:0;--w:4;--d:4">\n  <span class="tree tree--round" style="--x:1.5;--y:2;--s:1"></span>\n</div>');
  });

  test('adds roof extras for spires and gables', () => {
    const spire = expandComponents(
      '<polis-block x="0" y="0" w="4" d="4" kind="civic"><polis-building x="0" y="0" w="2" d="2" h="40" kind="landmark" roof="spire"/></polis-block>',
      'a.html',
    );
    assert.match(spire, /<span class="bldg__roof bldg__roof--spire"><\/span><span class="bldg__spire"><\/span><\/div>/);
    const gable = expandComponents(
      '<polis-block x="0" y="0" w="4" d="4" kind="oldtown"><polis-building x="0" y="0" w="2" d="2" h="3" kind="house" roof="gable"/></polis-block>',
      'a.html',
    );
    assert.equal((gable.match(/class="bldg__(slope|gable) /g) ?? []).length, 4);
  });

  test('expands a car with five faces and a validated paint colour', () => {
    const out = expandComponents('<polis-car route="a-east" delay="-4.5" paint="#E0B050"/>', 'a.html');
    assert.match(out, /^<div class="car car--a-east" style="--delay:-4.5s;--paint:#e0b050">/);
    assert.equal((out.match(/class="car__face /g) ?? []).length, 5);
  });

  test('ignores components inside HTML comments', () => {
    const html = '<!-- <polis-building x="0"> -->';
    assert.equal(expandComponents(html, 'a.html'), html);
  });

  test('every component and route has a definition', () => {
    assert.deepEqual(Object.keys(COMPONENTS).sort(), ['polis-block', 'polis-building', 'polis-car', 'polis-lamp', 'polis-tree']);
    assert.ok(ROUTES.length >= 4);
    assert.deepEqual(WORLD, { cols: 60, rows: 44 });
  });
});

describe('expandComponents: errors', () => {
  test('unknown component', () => {
    assertBuildError('<p>\n  <polis-tower x="1"></polis-tower>', 2, 3, /unknown component <polis-tower>/);
  });

  test('unknown attribute lists the allowed ones', () => {
    assertBuildError('<polis-block x="0" y="0" w="2" d="2" kind="park" colour="red"></polis-block>', 1, 50, /unknown attribute "colour".*x, y, w, d, kind/);
  });

  test('missing required attribute', () => {
    assertBuildError('<polis-block x="0" y="0" w="2" kind="park"></polis-block>', 1, 1, /missing attribute "d"/);
  });

  test('duplicate attribute', () => {
    assertBuildError('<polis-block x="0" x="1" y="0" w="2" d="2" kind="park"></polis-block>', 1, 20, /duplicate attribute "x"/);
  });

  test('attribute without a value', () => {
    assertBuildError('<polis-block x y="0" w="2" d="2" kind="park"></polis-block>', 1, 14, /attribute "x" needs a value/);
  });

  test('non-integer and out-of-range coordinates', () => {
    assertBuildError('<polis-block x="1.5" y="0" w="2" d="2" kind="park"></polis-block>', 1, 14, /"x" must be an integer from 0 to 59, got "1\.5"/);
    assertBuildError('<polis-block x="0" y="0" w="0" d="2" kind="park"></polis-block>', 1, 26, /"w" must be an integer from 1 to 60, got "0"/);
    assertBuildError('<polis-block x="0" y="0" w="2" d="2" kind="park"><polis-building x="0" y="0" w="1" d="1" h="99" kind="glass"/></polis-block>', 1, 90, /"h" must be an integer from 1 to 72/);
  });

  test('unknown kind', () => {
    assertBuildError('<polis-block x="0" y="0" w="2" d="2" kind="suburb"></polis-block>', 1, 38, /"kind" must be one of .*downtown.*, got "suburb"/);
  });

  test('a block that leaves the world', () => {
    assertBuildError('<polis-block x="50" y="0" w="12" d="2" kind="park"></polis-block>', 1, 1, /block leaves the world: x \+ w = 62 > 60/);
  });

  test('a building that does not fit in its block', () => {
    assertBuildError(
      '<polis-block x="0" y="0" w="4" d="4" kind="downtown">\n  <polis-building x="3" y="0" w="2" d="1" h="5" kind="glass"/>\n</polis-block>',
      2,
      3,
      /building does not fit in its block: x \+ w = 5 > 4/,
    );
  });

  test('overlapping buildings name the other building', () => {
    assertBuildError(
      '<polis-block x="0" y="0" w="9" d="9" kind="downtown">\n' +
        '  <polis-building x="0" y="0" w="3" d="3" h="5" kind="glass"/>\n' +
        '  <polis-building x="2" y="2" w="3" d="3" h="5" kind="glass"/>\n' +
        '</polis-block>',
      3,
      3,
      /overlaps the building at line 2/,
    );
  });

  test('touching buildings are allowed', () => {
    const html =
      '<polis-block x="0" y="0" w="9" d="9" kind="downtown">' +
      '<polis-building x="0" y="0" w="3" d="3" h="5" kind="glass"/>' +
      '<polis-building x="3" y="0" w="3" d="3" h="5" kind="glass"/>' +
      '</polis-block>';
    assert.doesNotThrow(() => expandComponents(html, 'a.html'));
  });

  test('buildings, trees and lamps must be inside a block', () => {
    assertBuildError('<polis-building x="0" y="0" w="1" d="1" h="1" kind="glass"/>', 1, 1, /<polis-building> must be inside <polis-block>/);
    assertBuildError('<div><polis-tree x="0" y="0"/></div>', 1, 6, /<polis-tree> must be inside <polis-block>/);
  });

  test('cars must not be inside a block', () => {
    assertBuildError('<polis-block x="0" y="0" w="2" d="2" kind="park"><polis-car route="a-east" delay="0" paint="#fff"/></polis-block>', 1, 50, /<polis-car> cannot be inside <polis-block>/);
  });

  test('blocks cannot nest', () => {
    assertBuildError('<polis-block x="0" y="0" w="2" d="2" kind="park"><polis-block x="0" y="0" w="1" d="1" kind="park"></polis-block></polis-block>', 1, 50, /<polis-block> cannot be inside <polis-block>/);
  });

  test('leaf components cannot have content', () => {
    assertBuildError('<polis-block x="0" y="0" w="2" d="2" kind="park"><polis-tree x="0" y="0">leaf</polis-tree></polis-block>', 1, 50, /<polis-tree> cannot have content/);
  });

  test('unclosed and mismatched tags', () => {
    assertBuildError('<main>\n<polis-block x="0" y="0" w="2" d="2" kind="park">\n</main>', 2, 1, /<polis-block> is never closed/);
    assertBuildError('<polis-block x="0" y="0" w="2" d="2" kind="park"></polis-tree>', 1, 50, /unexpected <\/polis-tree>, expected <\/polis-block>/);
    assertBuildError('</polis-block>', 1, 1, /unexpected <\/polis-block> with no open component/);
  });

  test('an unterminated start tag', () => {
    assertBuildError('<p></p><polis-block x="0" y="0"', 1, 8, /start tag is not terminated/);
  });

  test('paint must be a hex colour and route must be known', () => {
    assertBuildError('<polis-car route="a-east" delay="0" paint="red;background:url(x)"/>', 1, 37, /"paint" must be a hex colour/);
    assertBuildError('<polis-car route="ring" delay="0" paint="#fff"/>', 1, 12, /"route" must be one of/);
  });
});
