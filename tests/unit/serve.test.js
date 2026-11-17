import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { resolveRequest, BASE_PATH } from '../../tools/lib/serve.js';

const dist = resolve('/srv/dist');

describe('resolveRequest', () => {
  test('serves the site under the GitHub Pages sub-path', () => {
    assert.equal(BASE_PATH, '/polis-css-metropolis/');
    assert.deepEqual(resolveRequest(dist, '/polis-css-metropolis/'), { status: 200, file: join(dist, 'index.html') });
    assert.deepEqual(resolveRequest(dist, '/polis-css-metropolis/polis.css?v=1'), { status: 200, file: join(dist, 'polis.css') });
  });

  test('redirects the bare root and the base without its slash', () => {
    assert.deepEqual(resolveRequest(dist, '/'), { status: 302, location: BASE_PATH });
    assert.deepEqual(resolveRequest(dist, '/polis-css-metropolis'), { status: 302, location: BASE_PATH });
  });

  test('does not serve outside the base path (as on Pages, root URLs 404)', () => {
    assert.equal(resolveRequest(dist, '/polis.css').status, 404);
  });

  test('rejects path traversal, encoded or not', () => {
    assert.equal(resolveRequest(dist, '/polis-css-metropolis/../package.json').status, 403);
    assert.equal(resolveRequest(dist, '/polis-css-metropolis/%2e%2e/%2e%2e/package.json').status, 403);
    assert.equal(resolveRequest(dist, '/polis-css-metropolis/..%5c..%5cpackage.json').status, 403);
  });

  test('rejects malformed percent-encoding', () => {
    assert.equal(resolveRequest(dist, '/polis-css-metropolis/%E0%A4%A').status, 400);
  });
});
