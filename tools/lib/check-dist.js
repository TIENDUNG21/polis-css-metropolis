/**
 * The zero-JavaScript guarantee, enforced on the build output. `checkDist`
 * fails the build when dist/ contains anything a browser could execute as
 * script: <script> elements, on* event-handler attributes, javascript: URLs
 * (in HTML attributes, SVG animations and CSS url()), .js files, or embedded
 * browsing contexts that could load script from elsewhere. It also enforces
 * relative URLs so the page works under the GitHub Pages sub-path.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname, sep } from 'node:path';
import { positionAt } from './errors.js';
import { scanTags, decodeEntities } from './markup.js';

/**
 * @typedef {'script-tag' | 'event-handler' | 'javascript-url' | 'js-file' | 'embedded-content' | 'absolute-url'} Rule
 * @typedef {object} Violation
 * @property {string} file
 * @property {number} line
 * @property {number} column
 * @property {Rule} rule
 * @property {string} excerpt
 */

const EMBEDDED = new Set(['iframe', 'frame', 'object', 'embed', 'applet']);
const URL_ATTRS = new Set(['href', 'src', 'srcset', 'poster', 'action', 'formaction', 'data', 'xlink:href']);
const SCRIPT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);

/**
 * Browsers strip ASCII tab/newline anywhere in a URL and leading C0 controls
 * and spaces, and compare schemes case-insensitively.
 * @param {string} raw
 */
function normaliseUrl(raw) {
  const url = decodeEntities(raw).replace(/[\t\n\r]/g, '');
  let start = 0;
  while (start < url.length && url.charCodeAt(start) <= 0x20) start += 1;
  return url.slice(start).toLowerCase();
}

/** @param {string} value */
function containsJavascriptUrl(value) {
  const url = normaliseUrl(value);
  return url.startsWith('javascript:') || /url\s*=\s*['"]?\s*javascript:/.test(url);
}

/**
 * @param {string} text
 * @param {string} file
 * @param {number} index
 * @param {Rule} rule
 * @returns {Violation}
 */
function violation(text, file, index, rule) {
  const { line, column } = positionAt(text, index);
  const excerpt = text.slice(index, index + 60).split('\n')[0] ?? '';
  return { file, line, column, rule, excerpt };
}

/**
 * Decodes CSS escapes (`\6a ` or `\j`) so `url(\6a avascript:x)` is caught.
 * @param {string} value
 */
function decodeCssEscapes(value) {
  return value.replace(/\\([0-9a-fA-F]{1,6})[ \t\n]?|\\(.)/g, (_m, hex, ch) =>
    hex ? String.fromCodePoint(Number.parseInt(hex, 16)) : ch,
  );
}

/**
 * Finds url() targets and CSS import targets, outside comments.
 * @param {string} css
 * @returns {Array<{ index: number, value: string }>}
 */
function cssUrls(css) {
  const masked = css.replace(/\/\*[\s\S]*?\*\//g, (c) => ' '.repeat(c.length));
  /** @type {Array<{ index: number, value: string }>} */
  const found = [];
  for (const m of masked.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi)) {
    found.push({ index: m.index, value: decodeCssEscapes((m[1] ?? m[2] ?? m[3] ?? '').trim()) });
  }
  for (const m of masked.matchAll(/@import\s+(?:"([^"]*)"|'([^']*)')/gi)) {
    found.push({ index: m.index, value: decodeCssEscapes(m[1] ?? m[2] ?? '') });
  }
  return found.sort((a, b) => a.index - b.index);
}

/**
 * @param {string} css
 * @param {string} file
 * @param {number} [offset] Offset of `css` inside `source` when embedded.
 * @param {string} [source]
 * @returns {Violation[]}
 */
export function scanCss(css, file, offset = 0, source = css) {
  return cssUrls(css)
    .filter((u) => normaliseUrl(u.value).startsWith('javascript:'))
    .map((u) => violation(source, file, offset + u.index, 'javascript-url'));
}

/**
 * Scans HTML or SVG markup for executable content.
 * @param {string} text
 * @param {string} file
 * @returns {Violation[]}
 */
export function scanHtml(text, file) {
  /** @type {Violation[]} */
  const out = [];
  for (const token of scanTags(text)) {
    if (token.kind === 'raw') {
      if (token.name === 'style') out.push(...scanCss(token.text, file, token.index, text));
      continue;
    }
    if (token.kind === 'close') continue;
    if (token.name === 'script') out.push(violation(text, file, token.index, 'script-tag'));
    if (EMBEDDED.has(token.name)) out.push(violation(text, file, token.index, 'embedded-content'));
    for (const attr of token.attrs) {
      if (/^on[a-z]/.test(attr.name)) {
        out.push(violation(text, file, attr.index, 'event-handler'));
        continue;
      }
      if (attr.value === null) continue;
      if (attr.name === 'style') {
        const valueAt = text.indexOf(attr.value, attr.index);
        out.push(...scanCss(attr.value, file, valueAt === -1 ? attr.index : valueAt, text));
      } else if (containsJavascriptUrl(attr.value)) {
        out.push(violation(text, file, attr.index, 'javascript-url'));
      }
    }
  }
  return out;
}

/** @param {string} url */
const isRootOrProtocolRelative = (url) => url.trim().startsWith('/');

/**
 * Flags root-relative (`/x`) and protocol-relative (`//x`) URLs, which break
 * when the site is served from a sub-path.
 * @param {string} text
 * @param {string} file
 * @returns {Violation[]}
 */
export function checkRelativeUrls(text, file) {
  /** @type {Violation[]} */
  const out = [];
  for (const token of scanTags(text)) {
    if (token.kind === 'raw') {
      if (token.name === 'style') out.push(...checkRelativeCssUrls(token.text, file, token.index, text));
      continue;
    }
    if (token.kind !== 'open') continue;
    for (const attr of token.attrs) {
      if (attr.value === null || !URL_ATTRS.has(attr.name)) continue;
      const urls = attr.name === 'srcset' ? attr.value.split(',').map((c) => c.trim().split(/\s+/)[0] ?? '') : [attr.value];
      if (urls.some((u) => isRootOrProtocolRelative(decodeEntities(u)))) {
        out.push(violation(text, file, attr.index, 'absolute-url'));
      }
    }
  }
  return out;
}

/**
 * @param {string} css
 * @param {string} file
 * @param {number} [offset]
 * @param {string} [source]
 * @returns {Violation[]}
 */
export function checkRelativeCssUrls(css, file, offset = 0, source = css) {
  return cssUrls(css)
    .filter((u) => isRootOrProtocolRelative(u.value))
    .map((u) => violation(source, file, offset + u.index, 'absolute-url'));
}

/**
 * @param {string} dir
 * @returns {string[]} absolute file paths
 */
function walk(dir) {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

/**
 * Checks every file in a build output directory.
 * @param {string} dir
 * @returns {Violation[]}
 */
export function checkDist(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new Error(`Output directory ${dir} does not exist; run the build first.`);
  }
  /** @type {Violation[]} */
  const out = [];
  for (const full of walk(dir).sort()) {
    const file = relative(dir, full).split(sep).join('/');
    const ext = extname(full).toLowerCase();
    if (SCRIPT_EXTENSIONS.has(ext)) {
      out.push({ file, line: 1, column: 1, rule: 'js-file', excerpt: file });
      continue;
    }
    if (ext === '.html' || ext === '.htm' || ext === '.svg') {
      const text = readFileSync(full, 'utf8');
      out.push(...scanHtml(text, file), ...checkRelativeUrls(text, file));
    } else if (ext === '.css') {
      const text = readFileSync(full, 'utf8');
      out.push(...scanCss(text, file), ...checkRelativeCssUrls(text, file));
    }
  }
  return out;
}

/**
 * @param {Violation} v
 */
export function formatViolation(v) {
  return `${v.file}:${v.line}:${v.column} ${v.rule}  ${v.excerpt}`;
}
