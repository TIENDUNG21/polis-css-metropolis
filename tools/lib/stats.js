/**
 * Static measurements of the build output, and the animation audit.
 *
 * The audit keeps animation cheap: a keyframe may only animate properties
 * the compositor can handle (transform, the individual transform
 * properties, opacity), the motion-path offset, or a registered world-state
 * custom property. Anything else in a keyframe is reported.
 */
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { scanTags } from './markup.js';

export const ANIMATABLE = new Set(['transform', 'translate', 'rotate', 'scale', 'opacity', 'offset-distance']);

/**
 * Number of elements in an HTML document (start tags, comments excluded).
 * @param {string} html
 */
export function countElements(html) {
  let n = 0;
  for (const token of scanTags(html)) if (token.kind === 'open') n += 1;
  return n;
}

/**
 * Elements whose class list contains each given class.
 * @param {string} html
 * @param {string[]} classes
 * @returns {Record<string, number>}
 */
export function countByClass(html, classes) {
  /** @type {Record<string, number>} */
  const counts = Object.fromEntries(classes.map((c) => [c, 0]));
  for (const token of scanTags(html)) {
    if (token.kind !== 'open') continue;
    const cls = token.attrs.find((a) => a.name === 'class')?.value?.split(/\s+/) ?? [];
    for (const c of classes) if (cls.includes(c)) counts[c] = (counts[c] ?? 0) + 1;
  }
  return counts;
}

/**
 * Returns the body of the block that starts at `open` (index of `{`).
 * @param {string} css
 * @param {number} open
 */
function blockBody(css, open) {
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  throw new Error(`unbalanced braces after offset ${open}`);
}

/**
 * Every @keyframes block with the properties it animates.
 * @param {string} css
 * @returns {Array<{ name: string, properties: string[] }>}
 */
export function keyframes(css) {
  const out = [];
  for (const m of css.matchAll(/@keyframes\s+([\w-]+)\s*\{/g)) {
    const body = blockBody(css, m.index + m[0].length - 1);
    const props = new Set();
    for (const decl of body.matchAll(/[{;]\s*(--[\w-]+|[a-z-]+)\s*:/g)) props.add(decl[1]);
    out.push({ name: /** @type {string} */ (m[1]), properties: [...props].sort() });
  }
  return out;
}

/**
 * Names of custom properties registered with @property.
 * @param {string} css
 */
export function registeredProperties(css) {
  return new Set([...css.matchAll(/@property\s+(--[\w-]+)/g)].map((m) => /** @type {string} */ (m[1])));
}

/**
 * Keyframe properties outside the allowed set.
 * @param {string} css
 * @returns {string[]} messages, empty when the audit passes
 */
export function auditKeyframes(css) {
  const registered = registeredProperties(css);
  const problems = [];
  for (const { name, properties } of keyframes(css)) {
    for (const p of properties) {
      if (ANIMATABLE.has(p)) continue;
      if (p.startsWith('--')) {
        if (!registered.has(p)) problems.push(`@keyframes ${name} animates ${p}, which is not registered with @property`);
        continue;
      }
      problems.push(`@keyframes ${name} animates ${p}, which needs layout or paint every frame`);
    }
  }
  return problems;
}

/**
 * Transfer sizes of a text asset.
 * @param {string} text
 */
export function sizes(text) {
  const buf = Buffer.from(text);
  return {
    bytes: buf.length,
    gzip: gzipSync(buf, { level: 9 }).length,
    brotli: brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
  };
}
