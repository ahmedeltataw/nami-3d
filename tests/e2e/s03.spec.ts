import { expect, test } from '@playwright/test';

test('cold Arabic lab loads its models and renders @gpu', async ({ page }) => {
  // Cold asset loading plus six real SwiftShader renders share this test budget.
  test.setTimeout(270_000);
  const errors: string[] = [];
  const models: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => {
    if (response.url().includes('/models/s03/') || response.url().includes('/models/lab/')) {
      if (!response.ok()) errors.push(`Lab asset: ${response.status()} ${response.url()}`);
      else models.push(new URL(response.url()).pathname);
    }
  });
  await page.goto('/ar#s03');
  const host = page.locator('[data-experience]');
  await expect(host).toHaveAttribute('data-scene', 's03');
  await expect(host).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  await expect(page.locator('canvas:not([data-s01-energy-line])')).toHaveCount(1);
  await expect.poll(() => models.length).toBe(7);
  const colors = () => page.locator('canvas:not([data-s01-energy-line])').evaluate((canvas: HTMLCanvasElement) => new Promise<number>(resolve => requestAnimationFrame(() => {
    const gl = canvas.getContext('webgl2')!;
    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const colors = new Set<string>();
    for (let i = 0; i < pixels.length; i += 64) if (pixels[i + 3]) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    resolve(colors.size);
  })));
  expect(await colors()).toBeGreaterThan(20);
  await page.screenshot({ path: 'tests/e2e/__screens__/s03.png' });
  const dots = page.locator('[data-station-dots] button');
  await expect(dots).toHaveCount(6);
  for (let index = 0; index < 6; index++) {
    const dot = dots.nth(index);
    if (index % 2) { await dot.focus(); await page.keyboard.press(index === 3 ? 'Space' : 'Enter'); }
    else await dot.click();
    await expect(dot).toHaveAttribute('aria-current', 'step');
    await expect(page.locator('[data-station-dots] [aria-current="step"]')).toHaveCount(1);
    await expect(page.locator('#s03 h2')).toHaveText((await dot.getAttribute('aria-label'))!);
    await expect(host).toHaveAttribute('data-ready', 'true');
    await expect(dot).toBeInViewport({ ratio: 1 });
    await expect(page.locator('#s03 h2')).toBeInViewport({ ratio: 1 });
    await expect.poll(colors).toBeGreaterThan(20);
    await page.screenshot({ path: `test-results/s03-station-${index + 1}.png` });
  }
  expect(errors).toEqual([]);
});
