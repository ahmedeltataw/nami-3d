import { expect, test } from '@playwright/test';

test('cold Arabic lab loads its models and renders', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  const models: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => {
    if (response.url().includes('/models/lab/')) {
      if (!response.ok()) errors.push(`Lab asset: ${response.status()} ${response.url()}`);
      else models.push(new URL(response.url()).pathname);
    }
  });
  await page.goto('/ar#s03');
  const host = page.locator('[data-experience]');
  await expect(host).toHaveAttribute('data-scene', 's03');
  await expect(host).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect.poll(() => models.length).toBe(8);
  const colors = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => new Promise<number>(resolve => requestAnimationFrame(() => {
    const gl = canvas.getContext('webgl2')!;
    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const colors = new Set<string>();
    for (let i = 0; i < pixels.length; i += 64) if (pixels[i + 3]) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    resolve(colors.size);
  })));
  expect(colors).toBeGreaterThan(20);
  await page.screenshot({ path: 'tests/e2e/__screens__/s03.png' });
  expect(errors).toEqual([]);
});
