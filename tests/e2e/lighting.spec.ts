import { expect, test } from '@playwright/test';
import { scrollBody } from './motion-helpers';

test('lighting and post render identical frozen pixels after a reverse seek', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/en?capture=1&ambient=6&intro=8&experienceDebug=1');
  await expect.poll(async () => ({ ready: await page.locator('[data-experience]').getAttribute('data-ready'), errors }), { timeout: 30_000 }).toEqual({ ready: 'true', errors: [] });
  const canvas = page.locator('canvas:not([data-s01-energy-line])');
  const rendering = await canvas.evaluate(element => {
    const target = element as HTMLCanvasElement;
    const gl = target.getContext('webgl2');
    const extension = gl?.getExtension('WEBGL_debug_renderer_info') as { UNMASKED_RENDERER_WEBGL: number } | null;
    return {
      software: extension !== null && /swiftshader/i.test(gl!.getParameter(extension.UNMASKED_RENDERER_WEBGL)),
      antialias: gl?.getContextAttributes()?.antialias,
      pixelRatio: target.width / target.getBoundingClientRect().width,
    };
  });
  if (process.env.PLAYWRIGHT_GPU !== '1') expect(rendering.software).toBe(true);
  if (rendering.software) {
    expect(rendering.antialias).toBe(false);
    expect(rendering.pixelRatio).toBeCloseTo(1, 2);
  }
  const sample = async () => {
    await scrollBody(page, 's01', .18);
    await expect.poll(() => page.evaluate(() => window.__namiDebug?.().b)).toBeCloseTo(.18, 2);
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    // Read the rendered framebuffer; element screenshots also include changing HTML overlays.
    return canvas.evaluate((element: HTMLCanvasElement) => new Promise<{ image: string; colors: number }>(resolve => requestAnimationFrame(() => {
      const gl = element.getContext('webgl2')!;
      const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      const colors = new Set<string>();
      for (let i = 0; i < pixels.length; i += 64) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]},${pixels[i + 3]}`);
      resolve({ image: element.toDataURL('image/png'), colors: colors.size });
    })));
  };
  const first = await sample();
  expect(first.colors).toBeGreaterThan(20);
  await scrollBody(page, 's01', .4);
  await expect.poll(() => page.evaluate(() => window.__namiDebug?.().b)).toBeCloseTo(.4, 2);
  const repeated = await sample();
  expect(repeated.colors).toBeGreaterThan(20);
  expect(repeated.image).toBe(first.image);
  expect(errors).toEqual([]);
});
