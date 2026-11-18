import { scrollBody } from './motion-helpers';
import { expect, test } from '@playwright/test';
import Home from '../../src/messages/Home.ar.json';

test('Arabic headline, subtitle and primary CTA links are visible without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/ar');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('[data-s01-headline]')).toHaveText(Home.heading);
  await expect(page.locator('#s01 p').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'شاهد أعمالنا', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'ابدأ مشروعك', exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: 'شاهد أعمالنا', exact: true }).click();
  await expect(page.locator('#s05')).toBeInViewport();
  await context.close();
});

test('S01 renders the robot, keyboard skip ends the intro, and 60% scroll dollies the camera @gpu', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/ar?experienceDebug=1');
  await expect(page.locator('[data-experience]')).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => page.evaluate(() => window.__namiDebug?.().robotReady)).toBe(true);
  expect(await page.evaluate(() => window.__namiDebug!().robotMeshes)).toBeGreaterThan(10);
  const skip = page.getByRole('button', { name: 'تخطّي المقدمة', exact: true });
  await skip.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.__namiDebug!().introCancelled)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__namiDebug!().robot)).toMatchObject({ name: 'Idle', timeSeconds: 0 });
  expect(await page.evaluate(() => window.__namiDebug!().cameraZ)).toBeCloseTo(13, 2);
  await page.screenshot({ path: 'tests/e2e/__screens__/s01-start.png' });

  await scrollBody(page, 's01', .6);
  await expect.poll(() => page.evaluate(() => window.__namiDebug!().local)).toBeCloseTo(0.6, 2);
  await expect.poll(() => page.evaluate(() => window.__namiDebug!().cameraZ)).toBeCloseTo(13 - 2.4 / 9, 2);
  await expect.poll(() => page.evaluate(() => window.__namiDebug!().robot)).toMatchObject({ name: 'ChargeEnergy', timeSeconds: 0 });
  await page.screenshot({ path: 'tests/e2e/__screens__/s01-dolly.png' });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.evaluate(() => window.__namiDebug!().cameraZ)).toBeCloseTo(13, 2);
  await expect.poll(() => page.evaluate(() => window.__namiDebug!().robot)).toMatchObject({ name: 'Idle', timeSeconds: 0 });
  expect(errors).toEqual([]);
});

test('intro and scroll draw a canvas line and reveal the real HTML headline', async ({ page }) => {
  await page.goto('/en?experienceDebug=1');
  await expect(page.locator('[data-experience]')).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => page.evaluate(() => window.__namiDebug?.().robot), { intervals: [50], timeout: 8000 }).toMatchObject({ name: 'Wave' });
  const line = page.locator('[data-s01-energy-line]');
  // SwiftShader renders s01.kit at <10 fps, hitting clocks.tick's 100 ms delta clamp on the 3.4s intro beat.
  await expect(line).toHaveCSS('opacity', '1', { timeout: process.env.PLAYWRIGHT_GPU === '1' ? 5000 : 15_000 });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Start your project', exact: true }).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__namiDebug!().introCancelled)).toBe(true);
  await expect(line).toHaveCSS('opacity', '0');
  await scrollBody(page, 's01', .18);
  await expect(line).toHaveCSS('opacity', '1');
  await expect.poll(() => page.locator('[data-s01-headline]').evaluate(element => getComputedStyle(element).clipPath)).not.toBe('inset(0px 0% 0px 0px)');
  const visiblePixels = await line.evaluate((canvas: HTMLCanvasElement) => {
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    return pixels.some((value, i) => i % 4 === 3 && value > 0);
  });
  expect(visiblePixels).toBe(true);
  await scrollBody(page, 's01', .35);
  await expect(line).toHaveCSS('opacity', '0');
});

test('head proximity and click React stay in the composer and expire', async ({ page }) => {
  await page.goto('/en?experienceDebug=1');
  await expect(page.locator('[data-experience]')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Skip introduction', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.__namiDebug!().head.visible)).toBe(true);
  const head = await page.evaluate(() => window.__namiDebug!().head);
  await page.mouse.move(head.x, head.y);
  await page.mouse.click(head.x, head.y);
  await expect.poll(() => page.evaluate(() => window.__namiDebug!().reaction), { intervals: [20] }).toBe('React');
  await expect.poll(() => page.evaluate(() => window.__namiDebug!().reaction)).toBeUndefined();
  await page.mouse.click(head.x, head.y);
  expect(await page.evaluate(() => window.__namiDebug!().reaction)).toBeUndefined();
});

test('a scroll interruption at the current position samples the end pose immediately', async ({ page }) => {
  await page.goto('/en?experienceDebug=1');
  await expect(page.locator('[data-experience]')).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => page.evaluate(() => window.__namiDebug!().introCancelled)).toBe(false);
  await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
  await expect.poll(() => page.evaluate(() => window.__namiDebug!().robot)).toMatchObject({ name: 'Idle', timeSeconds: 0 });
  expect(await page.evaluate(() => window.__namiDebug!().introCancelled)).toBe(true);
  expect(await page.evaluate(() => window.__namiDebug!().local)).toBe(0);
});

test('reduced motion opens at the end state without an intro or continuous dolly', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/ar?experienceDebug=1');
  await expect(page.locator('[data-experience]')).toHaveAttribute('data-ready', 'true');
  expect(await page.evaluate(() => window.__namiDebug!().introCancelled)).toBe(true);
  expect(await page.evaluate(() => window.__namiDebug!().robot)).toEqual({ kind: 'pose', name: 'rest' });
  await expect(page.getByRole('button', { name: 'تخطّي المقدمة', exact: true })).toBeHidden();
  await scrollBody(page, 's01', .6);
  await expect.poll(() => page.evaluate(() => window.__namiDebug!().local)).toBeCloseTo(0.6, 2);
  expect(await page.evaluate(() => window.__namiDebug!().cameraZ)).toBeCloseTo(13, 2);
});

test('mobile S01 keeps content within the viewport and the head interaction reachable @gpu', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/ar?experienceDebug=1');
  await expect(page.locator('[data-experience]')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'تخطّي المقدمة', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'ابدأ مشروعك', exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const head = await page.evaluate(() => window.__namiDebug!().head);
  expect(head.visible).toBe(true);
  expect(head.x).toBeGreaterThan(0);
  expect(head.x).toBeLessThan(390);
  expect(head.y).toBeGreaterThan(0);
  expect(head.y).toBeLessThan(844);
  expect(await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('a, button'), head)).toBe(false);
  await page.mouse.click(head.x, head.y);
  await expect.poll(() => page.evaluate(() => window.__namiDebug!().reaction), { intervals: [20] }).toBe('React');
  await page.screenshot({ path: 'test-results/s01-mobile.png' });
});
