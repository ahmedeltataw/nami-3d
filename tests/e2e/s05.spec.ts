import { expect, test } from '@playwright/test';

test('cold Arabic gallery renders and all project links resolve', async ({ page, request }) => {
  const errors: string[] = [];
  const models: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (/\/models\/gallery\/.*\.glb$/.test(request.url())) models.push(new URL(request.url()).pathname); });
  await page.goto('/ar#s05');
  const host = page.locator('[data-experience]');
  await expect(host).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  await expect(host).toHaveAttribute('data-renderer', 'webgl');
  await expect(host).toHaveAttribute('data-scene', 's05');
  const canvas = page.locator('canvas');
  const colors = await canvas.evaluate((canvas: HTMLCanvasElement) => new Promise<number>(resolve => requestAnimationFrame(() => {
    const gl = canvas.getContext('webgl2')!;
    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const colors = new Set<string>();
    for (let i = 0; i < pixels.length; i += 64) if (pixels[i + 3]) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    resolve(colors.size);
  })));
  expect(colors).toBeGreaterThan(20);
  await page.screenshot({ path: 'tests/e2e/__screens__/s05-gallery.png' });
  const buttons = page.locator('[data-gallery-panel] nav button');
  for (let i = 0; i < 6; i++) {
    await buttons.nth(i).click();
    await expect(page.locator('[data-gallery-panel]')).toHaveAttribute('data-project', String(i));
    await expect(host).toHaveAttribute('data-ready', 'true');
    const link = page.locator('[data-project-card] a');
    const href = await link.getAttribute('href');
    expect((await request.get(href!)).status()).toBe(200);
    if (i === 0) {
      const explore = page.getByRole('group', { name: /اسحب/ });
      await explore.focus(); await page.keyboard.press('ArrowRight');
      const box = await explore.boundingBox();
      await page.mouse.move(box!.x + 20, box!.y + 20); await page.mouse.down();
      await page.mouse.move(box!.x + 70, box!.y + 30); await page.mouse.up();
      await page.screenshot({ path: 'tests/e2e/__screens__/s05-world.png' });
    }
  }
  expect(models.filter(url => url.endsWith('/portal_gate.glb'))).toHaveLength(1);
  expect(models.indexOf('/models/gallery/world_rif-aljouf.glb')).toBeLessThan(models.indexOf('/models/gallery/world_loryfy.glb'));
  expect(errors).toEqual([]);
});

test('mobile gallery fits and reduced motion keeps project selection accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en#s05');
  await expect(page.locator('[data-experience]')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Loryfy', exact: true }).click();
  await expect(page.locator('[data-gallery-panel]')).toHaveAttribute('data-project', '1');
  await expect(page.getByRole('group', { name: /Drag to explore/ })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('renderer fallback exposes all six real project links', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: function(this: HTMLCanvasElement, type: string, options?: unknown) {
      return type.startsWith('webgl') ? null : Reflect.apply(original, this, [type, options]);
    } });
  });
  await page.goto('/en#s05');
  await expect(page.locator('[data-experience]')).toHaveAttribute('data-renderer', 'fallback');
  await expect(page.locator('[data-project-card] a')).toHaveCount(6);
  await expect(page.locator('canvas')).toHaveCount(0);
});
