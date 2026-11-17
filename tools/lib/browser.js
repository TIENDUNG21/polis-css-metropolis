/**
 * Shared Playwright helpers for the dev tools (screenshots, measurements).
 * Locally they drive the installed Microsoft Edge; on CI, Playwright's Chromium.
 */
import { chromium } from '@playwright/test';

/** @typedef {import('@playwright/test').Page} Page */

export function launchBrowser() {
  return process.env.CI ? chromium.launch() : chromium.launch({ channel: 'msedge' });
}

/**
 * Parses "camera=street,time=night" into radio selections.
 * @param {string} spec
 * @returns {Array<[string, string]>}
 */
export function parseState(spec) {
  if (spec.trim() === '') return [];
  return spec.split(',').map((pair) => {
    const [group, value, ...rest] = pair.split('=').map((s) => s.trim());
    if (!group || !value || rest.length > 0 || !/^[a-z-]+$/.test(group) || !/^[a-z-]+$/.test(value)) {
      throw new Error(`bad state "${pair}"; expected group=value, e.g. camera=street`);
    }
    return [group, value];
  });
}

/**
 * Checks the radios for a state and waits until CSS transitions settle.
 * @param {Page} page
 * @param {Array<[string, string]>} state
 */
export async function applyState(page, state) {
  for (const [group, value] of state) {
    await page.check(`input[name="${group}"][value="${value}"]`, { force: true });
  }
  await settle(page);
}

/**
 * Waits until no CSS transition is running (camera flights, colour fades).
 * @param {Page} page
 */
export async function settle(page) {
  await page.waitForTimeout(100);
  await page.waitForFunction(
    () => document.getAnimations().every((a) => !(a instanceof CSSTransition) || a.playState !== 'running'),
    undefined,
    { timeout: 15000, polling: 100 },
  );
}
