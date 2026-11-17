// Usage: node tools/check-dist.js [dir]
// Exits 1 if the build output contains anything executable (see lib/check-dist.js).
import { resolve } from 'node:path';
import { checkDist, formatViolation } from './lib/check-dist.js';

const dir = resolve(process.argv[2] ?? 'dist');
try {
  const violations = checkDist(dir);
  if (violations.length > 0) {
    for (const v of violations) console.error(formatViolation(v));
    console.error(`\ncheck-dist: ${violations.length} violation(s); dist/ must contain HTML and CSS only.`);
    process.exit(1);
  }
  console.log('check-dist: no script, no event handlers, no javascript: URLs, no .js files, relative URLs only.');
} catch (error) {
  console.error(`check-dist: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}
