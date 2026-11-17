// Usage: node tools/build.js [outDir]
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './lib/build.js';
import { BuildError } from './lib/errors.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, process.argv[2] ?? 'dist');

try {
  const report = build({ root, outDir });
  const kb = (/** @type {number} */ n) => `${(n / 1024).toFixed(1)} KB`;
  console.log(
    `build: ${report.files.join(', ')} -> ${outDir}\n` +
      `       html ${kb(report.htmlBytes)}, css ${kb(report.cssBytes)} from ${report.scssFiles} Sass modules`,
  );
} catch (error) {
  if (error instanceof BuildError) {
    console.error(`build failed: ${error.message}`);
    process.exit(1);
  }
  throw error;
}
