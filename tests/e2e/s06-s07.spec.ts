import { expect, test } from '@playwright/test';

test('cold Arabic S06 NAMI DNA loads canvas, lists all 7 values, and has no console errors', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/ar#s06');
  const host = page.locator('[data-experience]');
  await expect(host).toHaveAttribute('data-scene', 's06');
  await expect(host).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  await expect(page.locator('canvas:not([data-s01-energy-line])')).toHaveCount(1);

  // All 7 company values listed in static HTML list
  const valueItems = page.locator('#s06 ol li');
  await expect(valueItems).toHaveCount(7);

  // Non-blank canvas verification
  const colors = await page.locator('canvas:not([data-s01-energy-line])').evaluate((canvas: HTMLCanvasElement) =>
    new Promise<number>(resolve =>
      requestAnimationFrame(() => {
        const gl = canvas.getContext('webgl2')!;
        const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
        gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        const set = new Set<string>();
        for (let i = 0; i < pixels.length; i += 64) {
          if (pixels[i + 3]) set.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
        }
        resolve(set.size);
      })
    )
  );
  expect(colors).toBeGreaterThan(10);

  // Screenshot s06-dna.png
  await page.screenshot({ path: 'tests/e2e/__screens__/s06-dna.png' });
  expect(errors).toEqual([]);
});

test('cold Arabic S07 Build Your Future loads canvas, sets data-project-type on button clicks, and has no console errors', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });

  await page.goto('/ar#s07');
  const host = page.locator('[data-experience]');
  await expect(host).toHaveAttribute('data-scene', 's07');
  await expect(host).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  await expect(page.locator('canvas:not([data-s01-energy-line])')).toHaveCount(1);

  const section = page.locator('#s07');

  // Verify option buttons set data-project-type on #s07
  const websiteBtn = page.locator('#s07 button[data-choice="website"]');
  await websiteBtn.click();
  await expect(section).toHaveAttribute('data-project-type', 'website');

  const mobileBtn = page.locator('#s07 button[data-choice="mobile"]');
  await mobileBtn.click();
  await expect(section).toHaveAttribute('data-project-type', 'mobile');

  const marketingBtn = page.locator('#s07 button[data-choice="marketing"]');
  await marketingBtn.click();
  await expect(section).toHaveAttribute('data-project-type', 'marketing');

  const otherBtn = page.locator('#s07 button[data-choice="other"]');
  await otherBtn.click();
  await expect(section).toHaveAttribute('data-project-type', 'other');

  // Non-blank canvas verification
  const colors = await page.locator('canvas:not([data-s01-energy-line])').evaluate((canvas: HTMLCanvasElement) =>
    new Promise<number>(resolve =>
      requestAnimationFrame(() => {
        const gl = canvas.getContext('webgl2')!;
        const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
        gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        const set = new Set<string>();
        for (let i = 0; i < pixels.length; i += 64) {
          if (pixels[i + 3]) set.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
        }
        resolve(set.size);
      })
    )
  );
  expect(colors).toBeGreaterThan(10);

  // Screenshot s07-core.png
  await page.screenshot({ path: 'tests/e2e/__screens__/s07-core.png' });
  expect(errors).toEqual([]);
});

test('S07 choice buttons support keyboard selection with reduced motion', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en?capture=1&ambient=0&intro=8#s07');
  const host = page.locator('[data-experience]');
  await expect(host).toHaveAttribute('data-renderer', 'webgl');
  await expect(host).toHaveAttribute('data-ready', 'true');
  const website = page.locator('#s07 button[data-choice="website"]');
  const mobile = page.locator('#s07 button[data-choice="mobile"]');
  await page.locator('body').focus();
  let reachedWebsite = false;
  for (let i = 0; i < 50; i++) {
    await page.keyboard.press('Tab');
    reachedWebsite = await page.evaluate(() => document.activeElement?.matches('#s07 button[data-choice="website"]') ?? false);
    if (reachedWebsite) break;
  }
  expect(reachedWebsite).toBe(true);
  await expect(website).toBeFocused();
  await expect(website).toHaveCSS('outline-style', 'solid');
  await expect(website).toHaveCSS('outline-width', '2px');
  await page.keyboard.press('Enter');
  await expect(website).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Tab');
  await expect(mobile).toBeFocused();
  await page.keyboard.press('Space');
  await expect(mobile).toHaveAttribute('aria-pressed', 'true');
  await expect(website).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#s07')).toHaveAttribute('data-project-type', 'mobile');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
