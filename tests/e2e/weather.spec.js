import { test, expect } from '@playwright/test';
import { applyState } from '../../tools/lib/browser.js';

const PROPS = ['cloud', 'rain', 'snowfall', 'wet', 'snow', 'fog'];

/** @param {import('@playwright/test').Page} page */
const weather = (page) =>
  page.evaluate((props) => {
    const style = getComputedStyle(/** @type {Element} */ (document.querySelector('.polis')));
    return Object.fromEntries(props.map((p) => [p, Number(style.getPropertyValue(`--${p}`))]));
  }, PROPS);

/**
 * Visibility and play state of every precipitation layer.
 * @param {import('@playwright/test').Page} page
 */
const layers = (page) =>
  page.$$eval('.rain, .snow', (els) =>
    Object.fromEntries(
      els.map((el) => {
        const s = getComputedStyle(el);
        return [el.className, `${s.visibility}/${s.animationPlayState}`];
      }),
    ),
  );

test('clear weather leaves every weather property at zero and every layer off', async ({ page }) => {
  await page.goto('./');
  expect(await weather(page)).toEqual({ cloud: 0, rain: 0, snowfall: 0, wet: 0, snow: 0, fog: 0 });
  expect(Object.values(await layers(page))).toEqual(Array(4).fill('hidden/paused'));
});

test('rain falls, wets the streets and thickens the clouds', async ({ page }) => {
  await page.goto('./');
  await applyState(page, [['weather', 'rain']]);
  expect(await weather(page)).toEqual({ cloud: 0.85, rain: 1, snowfall: 0, wet: 1, snow: 0, fog: 0.15 });
  expect(await layers(page)).toEqual({
    'rain rain--far': 'visible/running',
    'rain rain--near': 'visible/running',
    'snow snow--far': 'hidden/paused',
    'snow snow--near': 'hidden/paused',
  });
  const sheen = await page.$eval('.land', (el) => Number(getComputedStyle(el, '::after').opacity));
  expect(sheen).toBe(1);
});

test('snow falls and settles on roofs, then melts when the sky clears', async ({ page }) => {
  await page.goto('./');
  await applyState(page, [['weather', 'snow']]);
  expect(await weather(page)).toMatchObject({ snowfall: 1, snow: 1, rain: 0 });
  expect((await layers(page))['snow snow--near']).toBe('visible/running');
  const roof = () => page.$eval('.bldg__roof', (el) => Number(getComputedStyle(el, '::after').opacity));
  expect(await roof()).toBeCloseTo(0.92, 2);

  await page.check('input[name="weather"][value="clear"]', { force: true });
  await page.waitForTimeout(1500);
  // Snow melts over 6 s, so it is still partly there after 1.5 s...
  const melting = await roof();
  expect(melting).toBeGreaterThan(0.1);
  expect(melting).toBeLessThan(0.92);
  // ...and gone once the transition ends.
  await applyState(page, []);
  expect(await roof()).toBe(0);
});

test('fog shows its planes inside the 3D world and lowers contrast', async ({ page }) => {
  await page.goto('./');
  const planes = () =>
    page.$$eval('.fog', (els) => els.map((el) => `${getComputedStyle(el).visibility}:${getComputedStyle(el).opacity}`));
  expect(await planes()).toEqual(['hidden:0', 'hidden:0', 'hidden:0']);
  await applyState(page, [['weather', 'fog']]);
  expect(await weather(page)).toMatchObject({ fog: 1, cloud: 0.55 });
  expect(await planes()).toEqual(['visible:0.75', 'visible:0.55', 'visible:0.4']);
  const inWorld = await page.$$eval('.fog', (els) => els.every((el) => el.parentElement?.classList.contains('world')));
  expect(inWorld).toBe(true);
});

test('weather and time combine: rain at night keeps the lights on', async ({ page }) => {
  await page.goto('./');
  await applyState(page, [
    ['time', 'night'],
    ['weather', 'rain'],
  ]);
  const state = await page.evaluate(() => {
    const s = getComputedStyle(/** @type {Element} */ (document.querySelector('.polis')));
    return { night: Number(s.getPropertyValue('--night')), rain: Number(s.getPropertyValue('--rain')) };
  });
  expect(state).toEqual({ night: 1, rain: 1 });
  const stars = await page.$eval('.sky__stars', (el) => Number(getComputedStyle(el).opacity));
  expect(stars).toBeLessThan(0.2);
});
