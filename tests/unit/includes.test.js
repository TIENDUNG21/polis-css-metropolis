import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { resolveIncludes } from '../../tools/lib/includes.js';
import { BuildError } from '../../tools/lib/errors.js';

const root = join('/virtual', 'site');

/**
 * In-memory file system keyed by paths relative to `root`.
 * @param {Record<string, string>} files
 */
function memoryReader(files) {
  const byPath = new Map(Object.entries(files).map(([k, v]) => [join(root, k), v]));
  /** @param {string} path */
  return (path) => {
    const text = byPath.get(path);
    if (text === undefined) throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    return text;
  };
}

describe('resolveIncludes', () => {
  test('inlines nested includes relative to the including file', () => {
    const read = memoryReader({
      'index.html': '<body>\n<!-- @include parts/a.html -->\n</body>',
      'parts/a.html': '<a><!-- @include b.html --></a>',
      'parts/b.html': '<b></b>',
    });
    assert.equal(resolveIncludes(join(root, 'index.html'), { root, read }), '<body>\n<a><b></b></a>\n</body>');
  });

  test('indents every included line like the include comment', () => {
    const read = memoryReader({
      'index.html': '<main>\n    <!-- @include part.html -->\n</main>',
      'part.html': '<p>1</p>\n<p>2</p>\n',
    });
    assert.equal(resolveIncludes(join(root, 'index.html'), { root, read }), '<main>\n    <p>1</p>\n    <p>2</p>\n</main>');
  });

  test('reports a missing file at the include line and column', () => {
    const read = memoryReader({ 'index.html': '<body>\n\n  <!-- @include missing.html -->' });
    assert.throws(
      () => resolveIncludes(join(root, 'index.html'), { root, read }),
      (/** @type {unknown} */ err) => {
        assert.ok(err instanceof BuildError);
        assert.equal(err.file, 'index.html');
        assert.equal(err.line, 3);
        assert.equal(err.column, 3);
        assert.match(err.message, /cannot include "missing\.html": file not found/);
        return true;
      },
    );
  });

  test('reports an include cycle with the whole chain', () => {
    const read = memoryReader({
      'a.html': '<!-- @include b.html -->',
      'b.html': 'x\n<!-- @include a.html -->',
    });
    assert.throws(() => resolveIncludes(join(root, 'a.html'), { root, read }), /include cycle: a\.html -> b\.html -> a\.html/);
  });

  test('rejects an include without a path', () => {
    const read = memoryReader({ 'a.html': '<!-- @include -->' });
    assert.throws(() => resolveIncludes(join(root, 'a.html'), { root, read }), /a\.html:1:1 @include needs a file path/);
  });

  test('applies the transform to each file before inlining, with that file name', () => {
    const read = memoryReader({ 'a.html': 'A<!-- @include b.html -->', 'b.html': 'B' });
    /** @type {string[]} */
    const seen = [];
    const out = resolveIncludes(join(root, 'a.html'), {
      root,
      read,
      transform: (text, file) => {
        seen.push(file);
        return text.toLowerCase();
      },
    });
    assert.equal(out, 'ab');
    assert.deepEqual(seen, ['a.html', 'b.html']);
  });

  test('leaves ordinary comments alone', () => {
    const read = memoryReader({ 'a.html': '<!-- note: not an include -->' });
    assert.equal(resolveIncludes(join(root, 'a.html'), { root, read }), '<!-- note: not an include -->');
  });
});
