import { test, expect } from '@playwright/test';
import { applyState, settle } from '../../tools/lib/browser.js';

/** Every CSS animation on the page, with its play state. */
const animationStates = () =>
  document
    .getAnimations()
    .filter((a) => a instanceof CSSAnimation)
    .map((a) => a.playState);

test('every control is a labelled radio inside a named group', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Polis');
  const groups = { Time: 5, Weather: 4, Camera: 5, Motion: 2 };
  for (const [name, count] of Object.entries(groups)) {
    await expect(page.getByRole('group', { name }).getByRole('radio')).toHaveCount(count);
  }
  await expect(page.getByRole('radio', { name: 'Night' })).toHaveCount(1);
  await expect(page.getByRole('radio', { name: 'Riverside' })).toHaveCount(1);
  await expect(page.getByRole('region', { name: 'City controls' })).toHaveCount(1);
});

test('the console works from the keyboard and shows where focus is', async ({ page }) => {
  await page.goto('./');
  await page.keyboard.press('Tab');
  const focused = () => page.evaluate(() => {
    const el = /** @type {HTMLInputElement} */ (document.activeElement);
    return `${el.name}=${el.value}`;
  });
  expect(await focused()).toBe('time=auto');

  const ring = await page.evaluate(() => {
    const label = /** @type {Element} */ (document.activeElement?.closest('label'));
    const s = getComputedStyle(label);
    return { style: s.outlineStyle, color: s.outlineColor, width: s.outlineWidth };
  });
  expect(ring).toEqual({ style: 'solid', color: 'rgb(255, 158, 100)', width: '2px' });

  // Arrow keys move within a group and select; Tab moves to the next group.
  await page.keyboard.press('ArrowRight');
  expect(await focused()).toBe('time=dawn');
  await expect(page.locator('input[name="time"][value="dawn"]')).toBeChecked();
  await page.keyboard.press('Tab');
  expect(await focused()).toBe('weather=clear');
  await page.keyboard.press('ArrowLeft');
  expect(await focused()).toBe('weather=fog');
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowRight');
  expect(await focused()).toBe('camera=aerial');
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowRight');
  expect(await focused()).toBe('motion=paused');

  await settle(page);
  const state = await page.evaluate(() => {
    const s = getComputedStyle(/** @type {Element} */ (document.querySelector('.polis')));
    return { hour: s.getPropertyValue('--hour'), fog: s.getPropertyValue('--fog') };
  });
  expect(state).toEqual({ hour: '6', fog: '1' });
});

test('Motion: Paused stops every animation, and Live resumes them', async ({ page }) => {
  await page.goto('./');
  // Fog is the weather whose layers animate the most.
  await applyState(page, [['weather', 'fog']]);
  const live = await page.evaluate(animationStates);
  expect(live.length).toBeGreaterThan(20);
  expect(live).toContain('running');

  await page.getByText('Paused', { exact: true }).click();
  expect(new Set(await page.evaluate(animationStates))).toEqual(new Set(['paused']));

  await page.getByText('Live', { exact: true }).click();
  expect(await page.evaluate(animationStates)).toContain('running');
});

test.describe('with prefers-reduced-motion: reduce', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the city starts paused and the camera cuts instead of flying', async ({ page }) => {
    await page.goto('./');
    expect(new Set(await page.evaluate(animationStates))).toEqual(new Set(['paused']));

    await page.check('input[name="camera"][value="street"]', { force: true });
    const flying = await page.$eval('.camera', (el) => el.getAnimations().length);
    expect(flying).toBe(0);
    expect(await page.$eval('.camera', (el) => getComputedStyle(el).transitionDuration)).toBe('0s');
  });

  test('presets still apply (light fades are not motion)', async ({ page }) => {
    await page.goto('./');
    await applyState(page, [['time', 'night']]);
    const night = await page.evaluate(() =>
      getComputedStyle(/** @type {Element} */ (document.querySelector('.polis'))).getPropertyValue('--night'),
    );
    expect(night).toBe('1');
  });
});

test('the phone layout keeps the controls on screen and the clock clear of the title', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  const boxes = await page.evaluate(() =>
    Object.fromEntries(
      ['.masthead', '.hud', '.console'].map((s) => {
        const r = /** @type {Element} */ (document.querySelector(s)).getBoundingClientRect();
        return [s, { left: r.left, right: r.right, top: r.top, bottom: r.bottom }];
      }),
    ),
  );
  const m = boxes['.masthead'];
  const h = boxes['.hud'];
  const c = boxes['.console'];
  expect(m && h && c).toBeTruthy();
  if (!m || !h || !c) return;
  expect(m.right).toBeLessThanOrEqual(h.left);
  expect(c.left).toBeGreaterThanOrEqual(0);
  expect(c.right).toBeLessThanOrEqual(390);
  expect(c.bottom).toBeLessThanOrEqual(844);
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBe(390);
});
