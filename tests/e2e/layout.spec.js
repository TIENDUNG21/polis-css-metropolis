import { test, expect } from '@playwright/test';

/**
 * Layout boxes before any 3D transform (offsetLeft/Top/Width/Height),
 * i.e. the city plan as the CSS computes it from the tile coordinates.
 * @typedef {{ x: number, y: number, w: number, h: number, label: string }} Box
 */

/** @param {Box} a @param {Box} b */
const intersects = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** @param {Box} inner @param {Box} outer */
const inside = (inner, outer) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;

test.beforeEach(async ({ page }) => {
  await page.goto('./');
});

test('blocks lie inside the world, off the river and apart from each other', async ({ page }) => {
  const { world, river, blocks } = await page.evaluate(() => {
    /** @param {Element} el */
    const box = (el) => {
      const h = /** @type {HTMLElement} */ (el);
      return { x: h.offsetLeft, y: h.offsetTop, w: h.offsetWidth, h: h.offsetHeight, label: h.className };
    };
    const worldEl = /** @type {HTMLElement} */ (document.querySelector('.world'));
    return {
      world: { x: 0, y: 0, w: worldEl.offsetWidth, h: worldEl.offsetHeight, label: 'world' },
      river: box(/** @type {Element} */ (document.querySelector('.river'))),
      blocks: [...document.querySelectorAll('.block')].map(box),
    };
  });
  expect(world).toMatchObject({ w: 1200, h: 880 });
  expect(blocks).toHaveLength(6);
  for (const b of blocks) {
    expect(inside(b, world), `${b.label} inside the world`).toBe(true);
    expect(intersects(b, river), `${b.label} off the river`).toBe(false);
  }
  for (let i = 0; i < blocks.length; i += 1) {
    for (let j = i + 1; j < blocks.length; j += 1) {
      const a = /** @type {Box} */ (blocks[i]);
      const b = /** @type {Box} */ (blocks[j]);
      expect(intersects(a, b), `${a.label} vs ${b.label}`).toBe(false);
    }
  }
});

test('every building stands inside its block and no two buildings overlap', async ({ page }) => {
  const perBlock = await page.$$eval('.block', (blocks) =>
    blocks.map((block) => ({
      block: { x: 0, y: 0, w: /** @type {HTMLElement} */ (block).offsetWidth, h: /** @type {HTMLElement} */ (block).offsetHeight, label: block.className },
      buildings: [...block.querySelectorAll(':scope > .bldg')].map((el) => {
        const h = /** @type {HTMLElement} */ (el);
        return { x: h.offsetLeft, y: h.offsetTop, w: h.offsetWidth, h: h.offsetHeight, label: h.className };
      }),
    })),
  );
  let total = 0;
  for (const { block, buildings } of perBlock) {
    total += buildings.length;
    buildings.forEach((b, i) => {
      expect(b.w, `${b.label} has a footprint`).toBeGreaterThan(0);
      expect(inside(b, block), `${b.label} inside ${block.label}`).toBe(true);
      for (const other of buildings.slice(i + 1)) expect(intersects(b, other), `${b.label} vs ${other.label}`).toBe(false);
    });
  }
  expect(total).toBeGreaterThanOrEqual(60);
});

test('building heights follow --h in floors of 7px', async ({ page }) => {
  const heights = await page.$$eval('.bldg', (els) =>
    els.map((el) => ({
      floors: Number(getComputedStyle(el).getPropertyValue('--h')),
      wall: /** @type {HTMLElement} */ (el.querySelector('.bldg__wall--s')).offsetHeight,
    })),
  );
  for (const { floors, wall } of heights) expect(wall).toBe(floors * 7);
  expect(Math.max(...heights.map((h) => h.floors))).toBe(52);
});
