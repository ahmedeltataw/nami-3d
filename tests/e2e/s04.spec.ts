import { expect, test } from '@playwright/test';

test('S04 renders and Explore enters and exits', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/ar?experienceDebug=1#s04');
  const host = page.locator('[data-experience]');
  await expect(host).toHaveAttribute('data-scene', 's04');
  await expect(host).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
  const seek = async (local: number) => {
    await page.evaluate(value => { const section = document.getElementById('s04')!; window.scrollTo(0, section.offsetTop + section.offsetHeight * value); }, local);
    await expect.poll(() => page.evaluate(() => window.__namiDebug?.().local)).toBeCloseTo(local, 2);
  };
  await seek(.25);
  const colors = await page.locator('canvas:not([data-s01-energy-line])').evaluate((canvas: HTMLCanvasElement) => new Promise<number>(resolve => requestAnimationFrame(() => {
    const gl = canvas.getContext('webgl2')!; const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const colors = new Set<string>(); for (let i = 0; i < pixels.length; i += 64) if (pixels[i + 3]) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    resolve(colors.size);
  })));
  expect(colors).toBeGreaterThan(20);
  await page.screenshot({ path: 'tests/e2e/__screens__/s04-exploded.png' });
  await seek(.95);
  await page.screenshot({ path: 'tests/e2e/__screens__/s04-final.png' });
  await page.locator('#s04 button').first().click();
  await expect(page.locator('#s04 button[aria-pressed]')).toHaveCount(4);
  await page.keyboard.press('Escape');
  await expect(page.locator('#s04 button[aria-pressed]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
