import { expect, test } from '@playwright/test';

test('Arabic S01 loads one robot GLB and renders nonblank pixels with SwiftShader', async ({ page }) => {
  const errors: string[] = [];
  const models: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (/\/models\/robot\/robot_(high|low)\.glb$/.test(request.url())) models.push(new URL(request.url()).pathname); });
  await page.goto('/ar');
  const host = page.locator('[data-experience]');
  await expect(host).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(models).toHaveLength(1);
  const rendered = await page.locator('canvas').evaluate(async (canvas: HTMLCanvasElement) => {
    // Read immediately after the host's render while the default framebuffer is valid.
    return new Promise<number>(resolve => requestAnimationFrame(() => {
      const gl = canvas.getContext('webgl2')!;
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let opaque = 0;
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) opaque++;
      resolve(opaque);
    }));
  });
  expect(rendered).toBeGreaterThan(5000);
  await page.screenshot({ path: 'tests/e2e/__screens__/robot-s01.png' });
  expect(errors).toEqual([]);
});
