import { scrollBody, seekJump } from './motion-helpers';
import { expect, test, type Page } from '@playwright/test';

async function seek(page: Page, local: number) {
  await scrollBody(page, 's02', local);
  await expect.poll(() => page.evaluate(() => window.__namiDebug?.().local)).toBeCloseTo(local, 2);
}
async function colors(page: Page) {
  return page.locator('canvas:not([data-s01-energy-line])').evaluate((canvas: HTMLCanvasElement) => new Promise<number>(resolve => requestAnimationFrame(() => {
    const gl = canvas.getContext('webgl2')!;
    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const values = new Set<number>();
    for (let i = 0; i < pixels.length; i += 64) if (pixels[i + 3]) values.add((pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2]);
    resolve(values.size);
  })));
}

test('cold /ar#s02 renders charge, assembled portal, reverse seek and lab handoff without errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/ar?experienceDebug=1#s02');
  const host = page.locator('[data-experience]');
  await expect(host).toHaveAttribute('data-scene', 's02');
  await expect(host).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  await expect(page.locator('canvas:not([data-s01-energy-line])')).toHaveCount(1);
  await expect.poll(() => colors(page)).toBeGreaterThan(20);
  await seek(page, .28);
  await expect.poll(() => page.evaluate(() => window.__namiDebug?.().robot)).toMatchObject({ name: 'ChargeEnergy' });
  await page.screenshot({ path: 'tests/e2e/__screens__/s02-charge.png' });
  await seek(page, .7);
  await expect.poll(() => colors(page)).toBeGreaterThan(30);
  await page.screenshot({ path: 'tests/e2e/__screens__/s02-portal.png' });
  await seek(page, .84);
  await expect.poll(() => page.evaluate(() => window.__namiDebug?.().robot)).toMatchObject({ name: 'Fly' });
  await seek(page, .28);
  await expect.poll(() => page.evaluate(() => window.__namiDebug?.().cameraZ)).toBeCloseTo(2.6, 2);
  await seekJump(page, 1, .999);
  await expect.poll(() => page.evaluate(() => window.__namiDebug?.().cameraZ)).toBeCloseTo(9, 1);
  expect(errors).toEqual([]);
});

test('mobile reduced-motion S02 keeps a fixed camera until the discrete dissolve', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/ar?experienceDebug=1#s02');
  await expect(page.locator('[data-experience]')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  await seek(page, .8);
  await expect.poll(() => page.evaluate(() => window.__namiDebug?.().cameraZ)).toBeCloseTo(2.6, 2);
  expect(await page.evaluate(() => window.__namiDebug!().robot)).toEqual({ kind: 'pose', name: 'rest' });
  expect(await colors(page)).toBeGreaterThan(20);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('renderer fallback keeps the S02 poster and HTML available', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
      if (String(args[0]).startsWith('webgl')) return null;
      return original.apply(this, args);
    } as typeof original;
  });
  await page.goto('/ar#s02');
  await expect(page.locator('[data-experience]')).toHaveAttribute('data-renderer', 'fallback');
  await expect(page.locator('canvas:not([data-s01-energy-line])')).toHaveCount(0);
  await expect(page.locator('#s02')).toBeInViewport();
  await expect(page.locator('#s02 h2')).toBeVisible();
  await expect(page.locator('[data-experience] > div').first()).toHaveCSS('background-image', /s02\.svg/);
});
