import { test, expect } from '@playwright/test';
import { applyState } from '../../tools/lib/browser.js';

test.describe('page shell', () => {
  test('loads under the Pages sub-path with its stylesheet and no errors', async ({ page }) => {
    /** @type {string[]} */
    const problems = [];
    page.on('pageerror', (e) => problems.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') problems.push(m.text());
    });
    page.on('response', (r) => {
      if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`);
    });
    await page.goto('./');
    await expect(page).toHaveTitle('Polis CSS Metropolis');
    const bg = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
    expect(bg).toBe('rgb(10, 10, 10)');
    expect(problems).toEqual([]);
  });

  test('ships no script and no inline event handlers', async ({ page }) => {
    await page.goto('./');
    const found = await page.evaluate(() => ({
      scripts: document.scripts.length,
      handlers: [...document.querySelectorAll('*')].flatMap((el) =>
        [...el.attributes].filter((a) => /^on/i.test(a.name)).map((a) => `${el.tagName}.${a.name}`),
      ),
    }));
    expect(found).toEqual({ scripts: 0, handlers: [] });
  });

  test('the city is one labelled image for assistive technology', async ({ page }) => {
    await page.goto('./');
    const city = page.getByRole('img', { name: /miniature city/ });
    await expect(city).toHaveCount(1);
  });
});

test.describe('camera', () => {
  test('each preset moves the camera, and the move is a transition', async ({ page }) => {
    await page.goto('./');
    const camera = page.locator('.camera');
    const iso = await camera.evaluate((el) => getComputedStyle(el).transform);
    const seen = new Set([iso]);
    for (const preset of ['aerial', 'street', 'river', 'plan']) {
      await page.check(`input[name="camera"][value="${preset}"]`, { force: true });
      const moving = await camera.evaluate((el) => el.getAnimations().some((a) => a instanceof CSSTransition));
      expect(moving, `${preset} should animate`).toBe(true);
      await applyState(page, []);
      seen.add(await camera.evaluate((el) => getComputedStyle(el).transform));
    }
    expect(seen.size).toBe(5);
  });

  test('clicking a label selects its preset', async ({ page }) => {
    await page.goto('./');
    await page.getByText('Plan', { exact: true }).click();
    await expect(page.locator('input[name="camera"][value="plan"]')).toBeChecked();
  });
});
