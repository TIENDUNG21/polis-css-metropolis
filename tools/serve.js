// Usage: node tools/serve.js [--port 5180]
// Serves dist/ at http://127.0.0.1:<port>/polis-css-metropolis/
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, BASE_PATH } from './lib/serve.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const portArg = process.argv.indexOf('--port');
const port = portArg === -1 ? 5180 : Number(process.argv[portArg + 1]);

await startServer({ distDir: resolve(root, 'dist'), port });
console.log(`serving dist/ at http://127.0.0.1:${port}${BASE_PATH}`);
