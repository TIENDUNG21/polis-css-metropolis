/**
 * Pixel statistics for screenshots, computed in a blank page's canvas so
 * the tests need no image library. Used instead of pixel baselines, which
 * differ between Edge on Windows and Chromium on Linux.
 */

/**
 * @param {import('@playwright/test').Page} lab a blank page
 * @param {Buffer} png
 * @returns {Promise<{ luminance: number, width: number, height: number }>}
 */
export function imageStats(lab, png) {
  return lab.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const canvas = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
    const ctx = /** @type {OffscreenCanvasRenderingContext2D} */ (canvas.getContext('2d'));
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      sum += 0.2126 * (data[i] ?? 0) + 0.7152 * (data[i + 1] ?? 0) + 0.0722 * (data[i + 2] ?? 0);
    }
    return { luminance: sum / (data.length / 4) / 255, width: canvas.width, height: canvas.height };
  }, png.toString('base64'));
}

/**
 * Share of pixels whose largest channel difference exceeds `threshold`.
 * @param {import('@playwright/test').Page} lab
 * @param {Buffer} a
 * @param {Buffer} b
 * @param {number} [threshold]
 */
export function changedShare(lab, a, b, threshold = 24) {
  return lab.evaluate(
    async ([b64a, b64b, t]) => {
      /** @param {string} b64 */
      const pixels = async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const canvas = new OffscreenCanvas(img.naturalWidth, img.naturalHeight);
        const ctx = /** @type {OffscreenCanvasRenderingContext2D} */ (canvas.getContext('2d'));
        ctx.drawImage(img, 0, 0);
        return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      };
      const pa = await pixels(String(b64a));
      const pb = await pixels(String(b64b));
      let changed = 0;
      for (let i = 0; i < pa.length; i += 4) {
        const d = Math.max(
          Math.abs((pa[i] ?? 0) - (pb[i] ?? 0)),
          Math.abs((pa[i + 1] ?? 0) - (pb[i + 1] ?? 0)),
          Math.abs((pa[i + 2] ?? 0) - (pb[i + 2] ?? 0)),
        );
        if (d > Number(t)) changed += 1;
      }
      return changed / (pa.length / 4);
    },
    [a.toString('base64'), b.toString('base64'), threshold],
  );
}
