import { seekJump } from './motion-helpers';
import { expect, test } from '@playwright/test';

test('all boundaries mount both scenes, reverse, and release after a rapid seek', async ({ page }) => {
  test.setTimeout(270_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/en?experienceDebug=1#s01');
  const host = page.locator('[data-experience]');
  await expect(host).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  const ids = ['s01', 's02', 's03', 's04', 's05', 's06', 's07'];
  async function seek(scene: string, local: number) {
    await page.evaluate(({ scene, local }) => {
      (window as unknown as { __namiController: { seek(scene: string, local: number): void } }).__namiController.seek(scene, local);
    }, { scene, local });
  }
  for (let i = 0; i < 6; i++) {
    for (const t of [.2, .7, .2]) {
      await seekJump(page, i, t, true);
      await expect.poll(() => page.evaluate(() => window.__namiDebug?.().mountedScenes), { timeout: 30_000 }).toEqual([ids[i], ids[i + 1]]);
      await expect.poll(() => page.evaluate(() => window.__namiDebug?.().transition?.id)).toBe(`${ids[i]}->${ids[i + 1]}`);
      await expect(host).toHaveAttribute('data-ready', 'true');
    }
    await seek(ids[i + 1], .25);
    await expect.poll(() => page.evaluate(() => window.__namiDebug?.().mountedScenes)).toEqual([ids[i + 1]]);
  }
  await page.evaluate(() => {
    const controller = (window as unknown as { __namiController: { seek(scene: string, local: number): void } }).__namiController;
    controller.seek('s03', .95); controller.seek('s05', .05); controller.seek('s07', .5);
  });
  await expect.poll(() => page.evaluate(() => window.__namiDebug?.().mountedScenes)).toEqual(['s07']);
  await expect(host).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('[data-transition-debug]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('reduced motion hash jumps mount one scene at boundary locals', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en?experienceDebug=1#s04');
  await expect(page.locator('[data-experience]')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  for (const scene of ['s02', 's04', 's06']) {
    await page.evaluate(scene => {
      (window as unknown as { __namiController: { seek(scene: string, local: number): void } }).__namiController.seek(scene, .95);
    }, scene);
    await expect.poll(() => page.evaluate(() => window.__namiDebug?.().mountedScenes)).toEqual([scene]);
    expect(await page.evaluate(() => window.__namiDebug?.().transition)).toBeNull();
  }
});
