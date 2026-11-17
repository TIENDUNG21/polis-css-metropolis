// Usage: node tools/measure.js [--seconds 10]   (run `npm run build` first)
// Runtime numbers in a real browser; writes docs/metrics/runtime.json.
// Locally this drives the installed Microsoft Edge (headless) through
// Playwright; numbers depend on the machine, which the report records.
import { writeFileSync, mkdirSync } from 'node:fs';
import { cpus, totalmem, type, release } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, BASE_PATH } from './lib/serve.js';
import { launchBrowser, applyState } from './lib/browser.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const secondsArg = process.argv.indexOf('--seconds');
const seconds = secondsArg === -1 ? 10 : Number(process.argv[secondsArg + 1]);
const port = 5183;

/** @type {Array<[string, Array<[string, string]>]>} */
const SCENARIOS = [
  ['auto cycle, clear', []],
  ['night, rain, street camera', [['time', 'night'], ['weather', 'rain'], ['camera', 'street']]],
  ['day, fog', [['time', 'day'], ['weather', 'fog']]],
  ['day, snow', [['time', 'day'], ['weather', 'snow']]],
  ['motion paused', [['motion', 'paused']]],
];

/** @param {number[]} sorted @param {number} q */
const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
/** @param {number} n */
const round = (n) => Math.round(n * 10) / 10;

const server = await startServer({ distDir: join(root, 'dist'), port });
const browser = await launchBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const url = `http://127.0.0.1:${port}${BASE_PATH}`;
  await page.goto(url, { waitUntil: 'load' });

  const load = await page.evaluate(() => {
    const nav = /** @type {PerformanceNavigationTiming | undefined} */ (performance.getEntriesByType('navigation')[0]);
    const gl = document.createElement('canvas').getContext('webgl');
    const info = gl?.getExtension('WEBGL_debug_renderer_info');
    return {
      domContentLoadedMs: nav ? nav.domContentLoadedEventEnd : null,
      loadMs: nav ? nav.loadEventEnd : null,
      elementsInDom: document.querySelectorAll('*').length,
      renderer: gl && info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : 'unknown',
    };
  });

  // Paint entries can arrive after the load event, so wait for the buffered one.
  const firstContentfulPaintMs = await page.evaluate(
    () =>
      new Promise((done) => {
        new PerformanceObserver((list) => {
          const entry = list.getEntriesByName('first-contentful-paint')[0];
          if (entry) done(entry.startTime);
        }).observe({ type: 'paint', buffered: true });
        setTimeout(() => done(null), 3000);
      }),
  );

  const scenarios = [];
  for (const [name, state] of SCENARIOS) {
    await page.goto(url, { waitUntil: 'load' });
    await applyState(page, state);
    const frames = await page.evaluate(
      (ms) =>
        new Promise((done) => {
          /** @type {number[]} */
          const stamps = [];
          const start = performance.now();
          /** @param {number} t */
          const tick = (t) => {
            stamps.push(t);
            if (t - start < ms) requestAnimationFrame(tick);
            else done(stamps);
          };
          requestAnimationFrame(tick);
        }),
      seconds * 1000,
    );
    const intervals = /** @type {number[]} */ (frames).slice(1).map((t, i) => t - (/** @type {number[]} */ (frames)[i] ?? t));
    const sorted = [...intervals].sort((a, b) => a - b);
    const total = intervals.reduce((a, b) => a + b, 0);
    scenarios.push({
      name,
      frames: intervals.length,
      fps: round((intervals.length / total) * 1000),
      medianFrameMs: round(quantile(sorted, 0.5)),
      p95FrameMs: round(quantile(sorted, 0.95)),
      framesOver33ms: intervals.filter((d) => d > 33.4).length,
    });
  }

  const report = {
    measuredAt: new Date().toISOString(),
    machine: {
      cpu: cpus()[0]?.model.trim() ?? 'unknown',
      logicalCores: cpus().length,
      memoryGB: Math.round(totalmem() / 2 ** 30),
      os: `${type()} ${release()}`,
    },
    browser: `${process.env.CI ? 'Chromium' : 'Microsoft Edge'} ${browser.version()} (headless, Playwright)`,
    viewport: '1440x900',
    secondsPerScenario: seconds,
    load: { firstContentfulPaintMs, ...load },
    scenarios,
  };
  mkdirSync(join(root, 'docs', 'metrics'), { recursive: true });
  writeFileSync(join(root, 'docs', 'metrics', 'runtime.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  server.close();
}
