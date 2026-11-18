import { SCROLL_MAP, TOTAL_BUDGET } from '../../src/experience/scroll-map';
import { directorDuration } from '../../src/experience/director';
import { expect, test } from '@playwright/test';
import { scrollBody, seekJump } from './motion-helpers';

test('capture clocks seek identically, overlays have one root, and only hero navigation moves focus', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/en?capture=1&ambient=6&intro=2&experienceDebug=1');
  await expect(page.locator('[data-experience]')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('[data-narrative-overlays]')).toHaveCount(1);
  await page.locator('a.skip-link').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-s01-headline]')).toBeFocused();
  await expect(page).toHaveURL(/#main$/);
  await expect.poll(() => page.evaluate(() => window.__namiDebug?.().ambientTime)).toBe(6);
  await expect.poll(() => page.evaluate(() => window.__namiDebug?.().introTime)).toBe(2);
  await scrollBody(page, 's01', .18);
  await expect.poll(() => page.evaluate(() => window.__namiDebug?.().b)).toBeCloseTo(.18, 2);
  const first = await page.evaluate(() => JSON.stringify(window.__namiDebug?.().snapshot));
  await scrollBody(page, 's01', .4);
  await scrollBody(page, 's01', .18);
  await expect.poll(() => page.evaluate(() => JSON.stringify(window.__namiDebug?.().snapshot))).toBe(first);
  await page.evaluate(() => window.__namiCapture?.({ ambientTime: 9, introTime: 1 }));
  expect(await page.evaluate(() => window.__namiDebug?.().ambientTime)).toBe(9);
  const nav = page.getByRole('link', { name: 's02', exact: true });
  await nav.click();
  await expect(page.locator('[data-overlay-scene="s02"] h2')).toBeFocused();
  expect(await page.evaluate(() => window.__namiDebug?.().b)).toBe(0);
  expect(await page.evaluate(() => window.__namiDebug?.().transition)).toBeNull();
  await scrollBody(page, 's02', .3);
  await expect.poll(() => page.evaluate(() => window.__namiDebug?.().b)).toBeCloseTo(.3, 2);
  await expect(page.locator('[data-overlay-scene="s02"] h2')).toBeFocused();
  await page.keyboard.press('PageDown');
  await expect(page.locator('#s03 h2')).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.__namiDebug?.().b)).toBe(0);
  expect(errors).toEqual([]);
});

test('an unready boundary holds an opaque DOM wash and evaluates the retained t when ready', async ({ page }) => {
  test.setTimeout(120_000);
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/models/lab/station_*.glb', async route => { await held; await route.continue(); });
  await page.goto('/en?capture=1&ambient=0&intro=8&experienceDebug=1#s02');
  await expect(page.locator('[data-experience]')).toHaveAttribute('data-ready', 'true');
  await seekJump(page, 1, .58, true);
  await expect.poll(() => page.evaluate(() => window.__namiDebug?.().loading)).toBe(true);
  await expect(page.locator('[data-jump-wash]')).toHaveCSS('opacity', '1');
  await expect(page.locator('[data-jump-loading]')).toBeVisible();
  let requested = await page.evaluate(() => window.__namiDebug?.().transition?.progress);
  expect(requested).toBeCloseTo(.58, 2);
  expect(await page.evaluate(() => window.__namiDebug?.().cameraZ)).toBeCloseTo(10.6, 2);
  await expect(page.locator('[data-overlay-scene="s02"] [data-scene-timeline]')).toHaveAttribute('inert', '');
  await seekJump(page, 1, .85, true);
  const row = SCROLL_MAP[1];
  const heldDuringScroll = await page.evaluate(progress => {
    window.__namiController!.scrollToProgress(progress);
    return { hold: document.querySelector<HTMLElement>('[data-jump-wash]')!.dataset.hold, opacity: getComputedStyle(document.querySelector('[data-jump-wash]')!).opacity, pulse: document.querySelector<HTMLElement>('[data-jump-loading]')!.hidden };
  }, (row.departure + .86 * (row.head + SCROLL_MAP[2].tail)) / TOTAL_BUDGET);
  expect(heldDuringScroll).toEqual({ hold: 'true', opacity: '1', pulse: false });
  requested = await page.evaluate(() => window.__namiDebug?.().transition?.progress);
  release();
  await expect.poll(() => page.evaluate(() => window.__namiDebug?.().loading), { timeout: 30_000 }).toBe(false);
  expect(await page.evaluate(() => window.__namiDebug?.().transition?.progress)).toBe(requested);
  await expect(page.locator('[data-jump-loading]')).toBeHidden();
});

test('Direct motion keeps hero samples, frozen ambient, and no wash', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en?experienceDebug=1#s02');
  await expect(page.locator('[data-experience]')).toHaveAttribute('data-ready', 'true');
  const before = await page.evaluate(() => ({ time: window.__namiDebug?.().ambientTime, snapshot: JSON.stringify(window.__namiDebug?.().snapshot) }));
  await scrollBody(page, 's02', .7);
  await expect.poll(() => page.evaluate(() => window.__namiDebug?.().local)).toBeCloseTo(.7, 2);
  expect(await page.evaluate(() => window.__namiDebug?.().ambientTime)).toBe(before.time);
  expect(await page.evaluate(() => JSON.stringify(window.__namiDebug?.().snapshot))).toBe(before.snapshot);
  expect(await page.evaluate(() => window.__namiDebug?.().transition)).toBeNull();
  await expect(page.locator('[data-jump-wash]')).toBeHidden();
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`S06 hero clears navigation and S07 actions remain clickable throughout the body at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const locale = viewport.width === 1280 ? 'ar' : 'en';
    await page.goto(`/${locale}?capture=1&ambient=0&intro=8&experienceDebug=1#s06`);
    await expect(page.locator('[data-experience]')).toHaveAttribute('data-ready', 'true');
    const navBottom = await page.locator('header').first().evaluate(node => node.getBoundingClientRect().bottom);
    for (const scene of ['s06', 's07'] as const) {
      for (const b of scene === 's06' ? [0] : [0, .3, .5, 1]) {
        await scrollBody(page, scene, b);
        const heading = page.locator(`#${scene} h2`).first();
        await expect(heading).toBeInViewport({ ratio: 1 });
        expect((await heading.boundingBox())!.y).toBeGreaterThanOrEqual(navBottom);
        if (scene === 's07') {
          await expect(page.locator('#s07 a[href*="/contact"]')).toBeInViewport({ ratio: 1 });
          for (const button of await page.locator('#s07 [data-choice]').all()) {
            await expect(button).toBeInViewport({ ratio: 1 });
            await button.click();
            await expect(button).toHaveAttribute('aria-pressed', 'true');
          }
        }
      }
      await page.screenshot({ path: `captures/mo1-review/carbon-${scene}-${viewport.width}.png` });
    }
  });
}
test('Direct motion can select all six services and all six still project worlds', async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/en?experienceDebug=1#s03');
  await expect(page.locator('[data-experience]')).toHaveAttribute('data-ready', 'true');
  const dots = page.locator('[data-station-dots] button');
  for (let i = 0; i < 6; i++) {
    const button = dots.nth(i); await button.click();
    await expect(button).toHaveAttribute('aria-current', 'step');
    await expect(page.locator('#s03 h2')).toHaveText((await button.getAttribute('aria-label'))!);
    await expect.poll(() => page.evaluate(() => window.__namiDebug?.().snapshot?.visual.station)).toBe(i + 1);
  }
  await page.getByRole('link', { name: 's05', exact: true }).click();
  const projects = page.locator('[data-gallery-panel] nav button');
  for (let i = 0; i < 6; i++) {
    await projects.nth(i).click();
    await expect(projects.nth(i)).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.evaluate(() => window.__namiDebug?.().snapshot?.visual.activeTarget)).toBe(i);
  }
  expect(await page.evaluate(() => window.__namiDebug?.().transition)).toBeNull();
});
test('DOM ownership follows the opaque seam in both directions', async ({ page }) => {
  await page.goto('/en?capture=1&intro=8&experienceDebug=1#s02');
  const host = page.locator('[data-experience]');
  await expect(host).toHaveAttribute('data-ready', 'true');
  for (const [t, owner] of [[.52, 's02'], [.576, 's03'], [.55, 's02']] as const) {
    await seekJump(page, 1, t);
    await expect(host).toHaveAttribute('data-scene', owner);
    expect(await page.evaluate(() => window.__namiDebug?.().owner)).toBe(owner);
  }
});
test('Director keeps S07 dwell, preserves control focus and does not push timer history', async ({ page }) => {
  await page.goto('/en?capture=1&intro=8&experienceDebug=1');
  await expect(page.locator('[data-experience]')).toHaveAttribute('data-ready', 'true');
  await page.clock.install({ time: new Date('2025-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2025-01-01T00:01:00Z'));
  await page.getByRole('button', { name: 'Show me NAMI', exact: true }).click();
  await page.evaluate(() => window.__namiController!.seek('s06', 0, false));
  await page.clock.runFor(100);
  await expect(page.locator('[data-experience]')).toHaveAttribute('data-scene', 's06');
  await expect(page.locator('[data-director]')).toHaveAttribute('data-director', 'playing');
  const skip = page.getByRole('button', { name: 'Skip scene', exact: true });
  await skip.focus();
  const historyLength = await page.evaluate(() => history.length);
  await page.clock.fastForward(directorDuration('s06') + 20);
  await expect(page.locator('[data-experience]')).toHaveAttribute('data-scene', 's07');
  await expect(page.locator('[data-director]')).toHaveAttribute('data-director', 'playing');
  await expect(skip).toBeFocused();
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  await page.clock.fastForward(500);
  await expect(page.locator('[data-director]')).toHaveAttribute('data-director', 'playing');
  await page.clock.fastForward(directorDuration('s07'));
  await expect(page.locator('[data-director]')).toHaveAttribute('data-director', 'idle');
});
test('Factory fills the viewport and profile re-attachment does not steal switch focus', async ({ page }) => {
  await page.goto('/en?capture=1&intro=8&experienceDebug=1');
  await expect(page.locator('[data-experience]')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Open hidden factory', exact: true }).click();
  const factory = page.getByRole('dialog');
  const box = (await factory.boundingBox())!;
  expect(box.x).toBe(0); expect(box.y).toBe(0);
  expect(box.width).toBe(page.viewportSize()!.width); expect(box.height).toBe(page.viewportSize()!.height);
  await page.keyboard.press('Escape');
  await scrollBody(page, 's02', .3);
  await page.waitForTimeout(250);
  await page.locator('button[aria-controls=mobile-nav-panel]').click();
  const motion = page.locator('#mobile-nav-panel').getByRole('button', { name: 'Direct', exact: true });
  await motion.click();
  await expect(motion).toBeFocused();
  await expect(page.locator('#mobile-nav-panel')).toBeVisible();
});

for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  test(`wheel over scene panels advances the page through S05/S06/S07 and back at ${viewport.width}px`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize(viewport);
    await page.goto('/en?capture=1&ambient=125.7&intro=8&experienceDebug=1#s05');
    await expect(page.locator('[data-experience]')).toHaveAttribute('data-ready', 'true');
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    // Seed both fully covered owner seams: a wheel must still reach the page.
    for (const boundary of [4, 5]) {
      await seekJump(page, boundary, .56);
      await expect(page.locator('[data-jump-wash]')).toHaveCSS('opacity', '1');
      const before = await page.evaluate(() => window.scrollY);
      await page.mouse.wheel(0, 40);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 20);
    }
    await scrollBody(page, 's05', .9);
    for (const scene of ['s06', 's07', 's06', 's05'] as const) {
      const target = await page.evaluate(({ scene, tail, budget }) => {
        const section = document.getElementById(scene)!;
        return section.offsetTop + section.offsetHeight * tail / budget;
      }, { scene, tail: SCROLL_MAP.find(row => row.id === scene)!.tail, budget: SCROLL_MAP.find(row => row.id === scene)!.budget });
      for (let step = 0; step < 18; step++) {
        const before = await page.evaluate(() => window.scrollY);
        const distance = target - before;
        if (Math.abs(distance) < 2) break;
        const progress = await page.evaluate(() => window.__namiDebug?.().progress);
        const delta = Math.sign(distance) * Math.min(600, Math.abs(distance));
        await page.mouse.wheel(0, delta);
        await expect.poll(() => page.evaluate(before => Math.abs(window.scrollY - before), before)).toBeGreaterThan(Math.min(20, Math.abs(delta) / 2));
        await expect.poll(() => page.evaluate(expected => Math.abs(window.scrollY - expected), before + delta)).toBeLessThan(2);
        await expect.poll(() => page.evaluate(() => window.__namiDebug?.().progress)).not.toBe(progress);
      }
      await expect.poll(() => page.evaluate(() => window.__namiDebug?.().owner)).toBe(scene);
      expect(Math.abs(await page.evaluate(() => window.scrollY) - target)).toBeLessThan(2);
    }
  });
}
test('nav, hash history, CTA and End focus the now-active S06/S07 headings', async ({ page }) => {
  await page.goto('/en?capture=1&intro=8&experienceDebug=1');
  await expect(page.locator('[data-experience]')).toHaveAttribute('data-ready', 'true');
  const s06 = page.locator('#s06 h2').first(); const s07 = page.locator('#s07 h2');
  await page.getByRole('link', { name: 's06', exact: true }).click(); await expect(s06).toBeFocused();
  await page.getByRole('link', { name: 's07', exact: true }).click(); await expect(s07).toBeFocused();
  await page.goBack(); await expect(s06).toBeFocused();
  await page.keyboard.press('End'); await expect(s07).toBeFocused();
  await page.getByRole('link', { name: 's01', exact: true }).click();
  await page.locator('[data-overlay-scene="s01"] a[href="#s07"]').click(); await expect(s07).toBeFocused();
});
test('Time Machine owns page keys and remains visible until its explicit close', async ({ page }) => {
  await page.goto('/en?capture=1&intro=8&experienceDebug=1#s06');
  await expect(page.locator('[data-experience]')).toHaveAttribute('data-ready', 'true');
  await page.locator('[data-time-machine-open]').click();
  const dialog = page.locator('[data-time-machine]'); const slider = dialog.getByRole('slider');
  await expect(dialog).toBeVisible(); await slider.focus();
  const before = await page.evaluate(() => ({ y: scrollY, progress: window.__namiDebug?.().progress }));
  await page.keyboard.press('PageDown');
  await expect(dialog).toBeVisible(); await expect(dialog).toHaveAttribute('open', '');
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  expect(await page.evaluate(() => window.__namiDebug?.().scene)).toBe('s06');
  expect(await page.evaluate(() => ({ y: scrollY, progress: window.__namiDebug?.().progress }))).toEqual(before);
  await page.keyboard.press('End'); await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible();
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
});
