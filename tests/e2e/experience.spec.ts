import { expect, test } from '@playwright/test';

test('cold #s05 loads its destination first, renders WebGL and seeks every hash on one canvas', async ({ page }) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  const assets: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (request.url().includes('/posters/')) assets.push(new URL(request.url()).pathname); });
  await page.goto('/ar#s05');
  const host = page.locator('[data-experience]');
  await expect(host).toHaveAttribute('data-ready', 'true');
  await expect(host).toHaveAttribute('data-scene', 's05');
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => !!canvas.getContext('webgl2'))).toBe(true);
  expect(assets[0]).toBe('/posters/s05.svg');
  expect(assets).not.toContain('/posters/s04.svg');
  await page.screenshot({ path: 'test-results/experience-ar-s05.png' });
  await page.locator('canvas').evaluate(canvas => canvas.setAttribute('data-persistent', 'original'));
  for (let index = 1; index <= 7; index++) {
    const id = `s0${index}`;
    await page.getByRole('link', { name: id, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`#${id}$`));
    await expect(host).toHaveAttribute('data-scene', id);
    await expect(host).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('canvas')).toHaveAttribute('data-persistent', 'original');
    expect(await page.locator(`#${id}`).evaluate(element => Math.abs(element.getBoundingClientRect().top))).toBeLessThan(2);
  }
  await page.goBack();
  await expect(host).toHaveAttribute('data-scene', 's06');
  await page.goForward();
  await expect(host).toHaveAttribute('data-scene', 's07');
  expect(errors).toEqual([]);
});

test('WebGL denied keeps server sections and native links usable without a Canvas', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', { value: function(this: HTMLCanvasElement, type: string, options?: unknown) {
      if (type.startsWith('webgl') || type === 'experimental-webgl') return null;
      return Reflect.apply(original, this, [type, options]);
    } });
  });
  await page.goto('/ar#s05');
  await expect(page.locator('[data-experience]')).toHaveAttribute('data-renderer', 'fallback');
  // The controller is attached after idle startup even when there is no renderer.
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
  await expect(page.locator('canvas')).toHaveCount(0);
  for (let index = 1; index <= 7; index++) {
    const id = `s0${index}`;
    await page.getByRole('link', { name: id, exact: true }).click();
    await expect(page.locator(`#${id}`)).toBeInViewport();
    await expect(page.locator(`#${id} p`).first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('context loss shows the poster then restores current narrative on the same Canvas', async ({ page }) => {
  await page.goto('/en#s05');
  const host = page.locator('[data-experience]');
  await expect(host).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  const loss = await page.locator('canvas').evaluateHandle((canvas: HTMLCanvasElement) => {
    const extension = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context');
    if (!extension) throw new Error('Context-loss extension unavailable');
    extension.loseContext();
    return extension;
  });
  await expect(host).toHaveAttribute('data-ready', 'false');
  await loss.evaluate(extension => extension.restoreContext());
  await loss.dispose();
  await expect(host).toHaveAttribute('data-ready', 'true');
  await expect(host).toHaveAttribute('data-scene', 's05');
  await expect(page.locator('canvas')).toHaveCount(1);
});

test('reduced motion uses normal flow and no sticky content', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en#s05');
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');
  const metrics = await page.locator('#s03').evaluate(section => ({
    height: section.getBoundingClientRect().height,
    viewport: innerHeight,
    position: getComputedStyle(section.firstElementChild!).position,
  }));
  expect(metrics.position).toBe('static');
  expect(metrics.height).toBeLessThanOrEqual(metrics.viewport + 1);
  await page.getByRole('link', { name: 's01', exact: true }).click();
  await expect(page).toHaveURL(/#s01$/);
  await expect(page.locator('#s01')).toBeInViewport();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'full');
  await expect.poll(() => page.locator('#s03').evaluate(section => getComputedStyle(section.firstElementChild!).position)).toBe('sticky');
});

test('mobile toolbar height changes freeze budgets, orientation recomputes them, and content fits', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.matchMedia;
    window.matchMedia = query => {
      const result = original.call(window, query);
      if (query === '(pointer: coarse)') Object.defineProperty(result, 'matches', { value: true });
      return result;
    };
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/en#s03');
  await expect(page.locator('[data-experience]')).toHaveAttribute('data-ready', 'true');
  const height = await page.locator('#s03').evaluate(element => element.getBoundingClientRect().height);
  await page.setViewportSize({ width: 390, height: 740 });
  await expect.poll(() => page.locator('#s03').evaluate(element => element.getBoundingClientRect().height)).toBeCloseTo(height, 0);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => page.locator('#s03').evaluate(element => element.getBoundingClientRect().height)).toBeCloseTo(390 * 5.4, 0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (let index = 1; index <= 7; index++) {
    await page.getByRole('link', { name: `s0${index}`, exact: true }).click();
    await expect(page.locator('[data-experience]')).toHaveAttribute('data-scene', `s0${index}`);
  }
});

test('mid-scene progress survives motion changes and reload', async ({ page }) => {
  async function waitForLayout(motion: 'full' | 'reduced') {
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await expect.poll(() => page.evaluate(async expectedMotion => {
      function metrics() {
        return [scrollY, innerHeight, document.documentElement.scrollHeight,
          ...Array.from(document.querySelectorAll('main section')).flatMap(section => {
            const rect = section.getBoundingClientRect();
            return [rect.top + scrollY, rect.height];
          })];
      }
      const before = metrics();
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      const after = metrics();
      const section = document.getElementById('s05')!;
      const height = expectedMotion === 'reduced' ? innerHeight : innerHeight * Number(getComputedStyle(section).getPropertyValue('--budget')) / 100;
      return document.documentElement.dataset.motion === expectedMotion && document.fonts.status === 'loaded'
        && Math.abs(section.getBoundingClientRect().height - height) < 1
        && before.every((value, index) => Math.abs(value - after[index]) < 0.5);
    }, motion)).toBe(true);
  }

  await page.goto('/en#s05');
  await expect(page.locator('[data-experience]')).toHaveAttribute('data-ready', 'true');
  await waitForLayout('full');
  await page.locator('canvas').evaluate(canvas => canvas.setAttribute('data-persistent', 'original'));
  await page.evaluate(() => window.scrollBy(0, innerHeight * 4.8 * 0.4));
  await expect.poll(() => page.evaluate(() => history.state?.__namiExperience?.local as number)).toBeCloseTo(0.4, 2);
  for (const motion of ['reduce', 'no-preference'] as const) {
    await page.emulateMedia({ reducedMotion: motion });
    await expect(page.locator('html')).toHaveAttribute('data-motion', motion === 'reduce' ? 'reduced' : 'full');
    await waitForLayout(motion === 'reduce' ? 'reduced' : 'full');
    await expect.poll(() => page.locator('#s05').evaluate(section => -section.getBoundingClientRect().top / section.getBoundingClientRect().height)).toBeCloseTo(0.4, 2);
    await expect(page.locator('canvas')).toHaveAttribute('data-persistent', 'original');
  }
  await page.reload();
  await expect(page.locator('[data-experience]')).toHaveAttribute('data-ready', 'true');
  await waitForLayout('full');
  await expect.poll(() => page.locator('#s05').evaluate(section => -section.getBoundingClientRect().top / section.getBoundingClientRect().height)).toBeCloseTo(0.4, 2);
});

test('HTML and scene links exist before JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/ar#s05');
  await expect(page.locator('section')).toHaveCount(7);
  await expect(page.locator('#s05')).toBeInViewport();
  await expect(page.locator('canvas')).toHaveCount(0);
  await page.getByRole('link', { name: 's07', exact: true }).click();
  await expect(page.locator('#s07')).toBeInViewport();
  await context.close();
});
