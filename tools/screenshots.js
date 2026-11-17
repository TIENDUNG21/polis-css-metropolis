// Usage: node tools/screenshots.js [--out dir] [--size 1440x900] [--format png|webp] [name:state ...]
// Without shots, writes the README set. State example: camera=street,time=night
// Builds nothing: run `npm run build` first.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, BASE_PATH } from './lib/serve.js';
import { launchBrowser, parseState, applyState } from './lib/browser.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
/** @param {string} flag @param {string} fallback */
const option = (flag, fallback) => {
  const i = args.indexOf(flag);
  if (i === -1) return fallback;
  const value = args[i + 1] ?? fallback;
  args.splice(i, 2);
  return value;
};
const outDir = resolve(option('--out', join(root, 'docs', 'screenshots')));
const [width, height] = option('--size', '1440x900').split('x').map(Number);
const format = option('--format', 'webp');
const port = Number(option('--port', '5182'));

/** @type {Array<[string, string]>} */
const README_SET = [
  ['hero', 'motion=paused,time=dusk,weather=clear,camera=iso'],
  ['night-rain', 'motion=paused,time=night,weather=rain,camera=river'],
  ['snow-day', 'motion=paused,time=day,weather=snow,camera=aerial'],
  ['street-fog', 'motion=paused,time=dawn,weather=fog,camera=street'],
];
const shots = args.length > 0 ? args.map((a) => /** @type {[string, string]} */ (a.split(':', 2))) : README_SET;

const server = await startServer({ distDir: join(root, 'dist'), port });
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: width ?? 1440, height: height ?? 900 } });
  mkdirSync(outDir, { recursive: true });
  for (const [name, spec] of shots) {
    await page.goto(`http://127.0.0.1:${port}${BASE_PATH}`);
    const state = parseState(spec ?? '');
    const available = await page.$$eval('input[type=radio]', (els) =>
      els.map((e) => `${e.getAttribute('name')}=${e.getAttribute('value')}`),
    );
    await applyState(page, state.filter(([g, v]) => available.includes(`${g}=${v}`)));
    const png = await page.screenshot({ type: 'png' });
    let bytes = png;
    if (format === 'webp') {
      const dataUrl = await page.evaluate(async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d')?.drawImage(img, 0, 0);
        return canvas.toDataURL('image/webp', 0.82);
      }, png.toString('base64'));
      bytes = Buffer.from(dataUrl.split(',')[1] ?? '', 'base64');
    }
    const file = join(outDir, `${name}.${format}`);
    writeFileSync(file, bytes);
    console.log(`${file}  ${(bytes.length / 1024).toFixed(0)} KB  [${spec}]`);
  }
} finally {
  await browser.close();
  server.close();
}
