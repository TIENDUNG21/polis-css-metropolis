// Usage: node tools/stats.js        (run `npm run build` first)
// Static numbers for the build output; writes docs/metrics/static.json.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { countElements, countByClass, keyframes, registeredProperties, sizes, auditKeyframes } from './lib/stats.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'dist', 'index.html'), 'utf8');
const css = readFileSync(join(root, 'dist', 'polis.css'), 'utf8');

const report = {
  html: sizes(html),
  css: sizes(css),
  elements: countElements(html),
  city: countByClass(html, ['block', 'bldg', 'bldg__wall', 'tree', 'lamp', 'car', 'feature']),
  keyframes: keyframes(css),
  registeredProperties: registeredProperties(css).size,
  auditProblems: auditKeyframes(css),
};

mkdirSync(join(root, 'docs', 'metrics'), { recursive: true });
writeFileSync(join(root, 'docs', 'metrics', 'static.json'), `${JSON.stringify(report, null, 2)}\n`);

const kb = (/** @type {number} */ n) => `${(n / 1024).toFixed(1)} KB`;
console.log(`index.html  ${kb(report.html.bytes)} (gzip ${kb(report.html.gzip)}, brotli ${kb(report.html.brotli)})`);
console.log(`polis.css   ${kb(report.css.bytes)} (gzip ${kb(report.css.gzip)}, brotli ${kb(report.css.brotli)})`);
console.log(`elements    ${report.elements}`);
console.log(`city        ${JSON.stringify(report.city)}`);
console.log(`keyframes   ${report.keyframes.length}, registered properties ${report.registeredProperties}`);
console.log(`audit       ${report.auditProblems.length === 0 ? 'ok' : report.auditProblems.join('; ')}`);
