import { test, expect } from '@playwright/test';
import { applyState } from '../../tools/lib/browser.js';

/**
 * Steps every car animation through one full 24 s cycle (in 0.2 s steps)
 * with the top-down Plan camera, and maps each car's screen box back to
 * world pixels. The world is 1200 x 880 px; avenue A spans y 400-460 and
 * avenue B spans x 320-380 (see scss/core/_tokens.scss).
 */
test('cars stay on their roads, never touch, and never share the junction across avenues', async ({ page }) => {
  await page.goto('./');
  await applyState(page, [['camera', 'plan']]);

  const report = await page.evaluate(() => {
    const world = /** @type {HTMLElement} */ (document.querySelector('.world'));
    const cars = /** @type {HTMLElement[]} */ ([...document.querySelectorAll('.car')]);
    const anims = cars.map((car) => {
      const a = car.getAnimations().find((x) => x instanceof CSSAnimation && x.animationName === 'drive');
      if (!a) throw new Error('car without drive animation');
      a.pause();
      return a;
    });
    const roadA = { x0: 0, x1: 1200, y0: 400, y1: 460 };
    const roadB = { x0: 320, x1: 380, y0: 0, y1: 880 };
    const junction = { x0: 320, x1: 380, y0: 400, y1: 460 };
    /** @param {{x0:number,x1:number,y0:number,y1:number}} b @param {{x0:number,x1:number,y0:number,y1:number}} r */
    const within = (b, r) => b.x0 >= r.x0 - 0.5 && b.x1 <= r.x1 + 0.5 && b.y0 >= r.y0 - 0.5 && b.y1 <= r.y1 + 0.5;
    /** @param {{x0:number,x1:number,y0:number,y1:number}} a @param {{x0:number,x1:number,y0:number,y1:number}} b */
    const touch = (a, b) => a.x0 < b.x1 - 0.5 && b.x0 < a.x1 - 0.5 && a.y0 < b.y1 - 0.5 && b.y0 < a.y1 - 0.5;

    /** @type {string[]} */
    const problems = [];
    let samples = 0;
    let visibleCars = 0;
    for (let step = 0; step < 120; step += 1) {
      const t = step * 200;
      for (const a of anims) a.currentTime = t;
      const w = world.getBoundingClientRect();
      const scale = w.width / 1200;
      const boxes = cars
        .map((car, i) => {
          const r = car.getBoundingClientRect();
          return {
            i,
            route: car.className.replace(/^.*car--/, ''),
            x0: (r.left - w.left) / scale,
            x1: (r.right - w.left) / scale,
            y0: (r.top - w.top) / scale,
            y1: (r.bottom - w.top) / scale,
            area: r.width * r.height,
          };
        })
        .filter((b) => b.area > 4 && b.x1 - b.x0 > 20 / 2 && b.y1 - b.y0 > 10 / 2);
      samples += 1;
      visibleCars += boxes.length;
      for (const b of boxes) {
        const road = b.route.startsWith('a-') ? roadA : roadB;
        if (!within(b, road)) problems.push(`t=${t}ms ${b.route}#${b.i} leaves its road`);
      }
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const p = /** @type {typeof boxes[number]} */ (boxes[i]);
          const q = /** @type {typeof boxes[number]} */ (boxes[j]);
          if (touch(p, q)) problems.push(`t=${t}ms ${p.route}#${p.i} touches ${q.route}#${q.i}`);
        }
      }
      const inJunction = boxes.filter((b) => touch(b, junction)).map((b) => b.route[0]);
      if (inJunction.includes('a') && inJunction.includes('b')) problems.push(`t=${t}ms junction shared by both avenues`);
    }
    return { problems, samples, cars: cars.length, averageVisible: visibleCars / samples };
  });

  expect(report.problems).toEqual([]);
  expect(report.samples).toBe(120);
  expect(report.cars).toBe(14);
  // Cars are really on the map (not all scaled away at the edges).
  expect(report.averageVisible).toBeGreaterThan(10);
});

test('the barge sails under the bridge, below street level', async ({ page }) => {
  await page.goto('./');
  const z = await page.evaluate(() => {
    const boat = /** @type {HTMLElement} */ (document.querySelector('.boat'));
    const cabin = /** @type {HTMLElement} */ (document.querySelector('.boat__cabin'));
    const river = /** @type {HTMLElement} */ (document.querySelector('.river'));
    const matrixZ = (/** @type {Element} */ el) => new DOMMatrix(getComputedStyle(el).transform).m43;
    return { river: matrixZ(river), cabin: matrixZ(cabin), boatParentIsRiver: boat.parentElement === river };
  });
  expect(z.boatParentIsRiver).toBe(true);
  // Cabin top relative to street level (0): river surface + cabin height < 0.
  expect(z.river + z.cabin).toBeLessThan(0);
});
