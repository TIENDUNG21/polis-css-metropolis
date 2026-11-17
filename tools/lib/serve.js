/**
 * A tiny static server for dist/, mounted at the same sub-path GitHub Pages
 * uses, so tests catch root-relative URLs. Dev and test only.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';

export const BASE_PATH = '/polis-css-metropolis/';

/** @type {Record<string, string>} */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/**
 * @typedef {{ status: 200, file: string } | { status: 302, location: string } | { status: 400 | 403 | 404 }} Resolution
 */

/**
 * Maps a request path to a file in `distDir`.
 * @param {string} distDir
 * @param {string} rawUrl
 * @returns {Resolution}
 */
export function resolveRequest(distDir, rawUrl) {
  const pathname = rawUrl.split(/[?#]/)[0] ?? '/';
  if (pathname === '/' || pathname === BASE_PATH.slice(0, -1)) return { status: 302, location: BASE_PATH };
  if (!pathname.startsWith(BASE_PATH)) return { status: 404 };
  let relative;
  try {
    relative = decodeURIComponent(pathname.slice(BASE_PATH.length));
  } catch {
    return { status: 400 };
  }
  if (relative === '' || relative.endsWith('/')) relative += 'index.html';
  const root = resolve(distDir);
  const segments = relative.split(/[\\/]/);
  if (segments.includes('..')) return { status: 403 };
  const file = resolve(join(root, ...segments));
  if (!file.startsWith(root + sep)) return { status: 403 };
  return { status: 200, file };
}

/**
 * @param {{ distDir: string, port: number, host?: string }} options
 * @returns {Promise<import('node:http').Server>}
 */
export function startServer({ distDir, port, host = '127.0.0.1' }) {
  const server = createServer(async (req, res) => {
    const r = resolveRequest(distDir, req.url ?? '/');
    if (r.status === 302) {
      res.writeHead(302, { location: r.location }).end();
      return;
    }
    if (r.status !== 200) {
      res.writeHead(r.status, { 'content-type': 'text/plain' }).end(String(r.status));
      return;
    }
    try {
      const body = await readFile(r.file);
      res
        .writeHead(200, {
          'content-type': TYPES[extname(r.file)] ?? 'application/octet-stream',
          'cache-control': 'no-store',
        })
        .end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('404');
    }
  });
  return new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolvePromise(server));
  });
}
