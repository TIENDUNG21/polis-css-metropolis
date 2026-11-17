import { test, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyState } from '../../tools/lib/browser.js';
import { imageStats, changedShare } from './helpers/image.js';

// Every preset is captured with motion paused and transitions settled, and
// saved under test-results/screens (uploaded by CI). The assertions are
// properties of the images, not pixel baselines.
const outDir = join('test-results', 'screens');

/**
 * @param {import('@playwright/test').Page} page
 * @param {string} name
 * @param {Array<[string, string]>} state
 * @param {{ hideSky?: boolean }} [options]
 */
async function capture(page, name, state, options = {}) {
  await page.goto('./');
  await applyState(page, [['motion', 'paused'], ...state]);
  // Hide the page chrome so only the scene is measured.
  const hidden = ['.masthead', '.hud', '.console', ...(options.hideSky ? ['.sky'] : [])];
  await page.addStyleTag({ content: `${hidden.join(', ')} { visibility: hidden; }` });
  const png = await page.screenshot();
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `${name}.png`), png);
  return png;
}

test('time of day: night is darker than dusk and dawn, which are darker than midday', async ({ page, context }) => {
  const lab = await context.newPage();
  /** @type {Record<string, number>} */
  const lum = {};
  for (const time of ['dawn', 'day', 'dusk', 'night']) {
    lum[time] = (await imageStats(lab, await capture(page, `time-${time}`, [['time', time]]))).luminance;
  }
  expect(lum.night).toBeLessThan(Number(lum.dusk) - 0.1);
  expect(lum.night).toBeLessThan(Number(lum.dawn) - 0.1);
  expect(lum.dusk).toBeLessThan(Number(lum.day));
  expect(lum.dawn).toBeLessThan(Number(lum.day));
});

test('weather: snow brightens the city, rain and fog change it visibly', async ({ page, context }) => {
  const lab = await context.newPage();
  const day = /** @type {Array<[string, string]>} */ ([['time', 'day']]);
  const clear = await capture(page, 'weather-clear', [...day, ['weather', 'clear']]);
  const snow = await capture(page, 'weather-snow', [...day, ['weather', 'snow']]);
  const rain = await capture(page, 'weather-rain', [...day, ['weather', 'rain']]);
  const fog = await capture(page, 'weather-fog', [...day, ['weather', 'fog']]);
  // Compare the city alone: the overcast snow sky is darker than a clear one.
  const cityClear = await capture(page, 'city-clear', [...day, ['weather', 'clear']], { hideSky: true });
  const citySnow = await capture(page, 'city-snow', [...day, ['weather', 'snow']], { hideSky: true });
  expect((await imageStats(lab, citySnow)).luminance).toBeGreaterThan((await imageStats(lab, cityClear)).luminance + 0.05);
  expect(await changedShare(lab, clear, snow)).toBeGreaterThan(0.2);
  expect(await changedShare(lab, clear, rain)).toBeGreaterThan(0.2);
  expect(await changedShare(lab, clear, fog)).toBeGreaterThan(0.2);
});

test('camera: every preset frames the city differently', async ({ page, context }) => {
  const lab = await context.newPage();
  const iso = await capture(page, 'camera-iso', [['camera', 'iso']]);
  for (const preset of ['aerial', 'street', 'river', 'plan']) {
    const shot = await capture(page, `camera-${preset}`, [['camera', preset]]);
    expect(await changedShare(lab, iso, shot), preset).toBeGreaterThan(0.05);
  }
});

test('the scene fills the frame: the city covers a large part of the screenshot', async ({ page, context }) => {
  const lab = await context.newPage();
  const iso = await capture(page, 'coverage', [['time', 'day']]);
  // Same frame with the city hidden: what remains is sky.
  await page.addStyleTag({ content: '.scene { visibility: hidden; }' });
  const sky = await page.screenshot();
  expect(await changedShare(lab, iso, sky)).toBeGreaterThan(0.25);
  expect((await imageStats(lab, iso)).width).toBe(1440);
});
