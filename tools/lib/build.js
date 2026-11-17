/**
 * Build: src/ HTML (+ components, includes) and scss/ -> dist/.
 * The output is HTML + CSS + an SVG icon. Nothing in dist/ executes.
 */
import { mkdirSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveIncludes } from './includes.js';
import { compileStyles } from './styles.js';

/**
 * @typedef {object} BuildReport
 * @property {string[]} files      Files written, relative to outDir.
 * @property {number} htmlBytes
 * @property {number} cssBytes
 * @property {number} scssFiles    Number of Sass modules compiled.
 */

/**
 * @param {{ root: string, outDir: string, transform?: (text: string, file: string) => string }} options
 * @returns {BuildReport}
 */
export function build({ root, outDir, transform }) {
  const html = resolveIncludes(join(root, 'src', 'index.html'), transform ? { root, transform } : { root });
  const { css, loadedFiles } = compileStyles(join(root, 'scss', 'main.scss'));

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), html);
  writeFileSync(join(outDir, 'polis.css'), css);
  copyFileSync(join(root, 'assets', 'logo.svg'), join(outDir, 'favicon.svg'));

  return {
    files: ['index.html', 'polis.css', 'favicon.svg'],
    htmlBytes: Buffer.byteLength(html),
    cssBytes: Buffer.byteLength(css),
    scssFiles: loadedFiles,
  };
}
