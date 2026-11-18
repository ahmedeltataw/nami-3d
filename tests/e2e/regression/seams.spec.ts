import { expect, test } from '@playwright/test';
import { seekJump } from '../motion-helpers';
import { boundaryBeats, captureAtBody, captureAtJump, JUMPS, openCapturePage } from './harness';

const EPSILON = 0.005;

test('seam tests at each scene swap ± ε flip owner inside the opaque interval with no visible owner change outside it', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  const clocks = { ambientTime: 6, introTime: 8 };
  await openCapturePage(page, { locale: 'en', ambient: clocks.ambientTime, intro: clocks.introTime, hash: 's01' });

  const host = page.locator('[data-experience]');
  const wash = page.locator('[data-jump-wash]');
  const docEl = page.locator('html');

  for (const jump of JUMPS) {
    const { boundary, id, from, to, beats, swap } = boundaryBeats(jump.boundary);
    const [opaqueStart, opaqueEnd] = beats.opaque;
    const [washInStart] = beats.washIn;
    const [, washOutEnd] = beats.washOut;

    const includePng = boundary === 0;
    // 1. Source exit frame (b = 1) matches jump start (t = 0)
    const sourceExit = await captureAtBody(page, from, 1, clocks, { includePng });
    const jumpStart = await captureAtJump(page, boundary, 0, { cold: false, clocks, includePng });
    expect(jumpStart.owner, `${id} t=0 owner`).toBe(from);
    expect(jumpStart.hash, `${id} t=0 canvas matches ${from} b=1`).toBe(sourceExit.hash);
    if (includePng) {
      expect(jumpStart.canvasSha256, `${id} t=0 PNG matches ${from} b=1`).toBe(sourceExit.canvasSha256);
    }

    // 2. Check samples across the jump: before wash, just before opaque, inside opaque (swap ± ε), just after opaque, after wash
    const samplePoints = [
      { t: Math.max(0.05, washInStart - 0.05), expectedOwner: from, opaque: false, washZero: true },
      { t: opaqueStart - EPSILON, expectedOwner: from, opaque: false, washZero: false },
      { t: opaqueStart + EPSILON, expectedOwner: from, opaque: true, washZero: false },
      { t: swap - EPSILON, expectedOwner: from, opaque: true, washZero: false },
      { t: swap + EPSILON, expectedOwner: to, opaque: true, washZero: false },
      { t: opaqueEnd - EPSILON, expectedOwner: to, opaque: true, washZero: false },
      { t: opaqueEnd + EPSILON, expectedOwner: to, opaque: false, washZero: false },
      { t: Math.min(0.95, washOutEnd + 0.05), expectedOwner: to, opaque: false, washZero: true },
    ] as const;

    // Ensure destination assets (including poster:${to}) are warm across the pass threshold before sampling
    await seekJump(page, boundary, 0.78);
    await expect.poll(() => page.evaluate(() => window.__namiDebug?.().loading), { timeout: 45_000 }).toBe(false);
    await expect(host).toHaveAttribute('data-scene', to);
    await seekJump(page, boundary, swap + EPSILON);
    await expect.poll(() => page.evaluate(() => window.__namiDebug?.().loading), { timeout: 45_000 }).toBe(false);
    await expect(host).toHaveAttribute('data-scene', to);

    for (const point of samplePoints) {
      await seekJump(page, boundary, point.t);
      await expect.poll(() => page.evaluate(() => window.__namiDebug?.().loading), { timeout: 45_000 }).toBe(false);
      await expect(host, `${id} data-scene at t=${point.t.toFixed(4)}`).toHaveAttribute('data-scene', point.expectedOwner);
      await expect(docEl, `${id} jumpOpaque attr at t=${point.t.toFixed(4)}`).toHaveAttribute(
        'data-jump-opaque',
        point.opaque ? 'true' : 'false',
      );

      const state = await page.evaluate(() => {
        const washNode = document.querySelector<HTMLElement>('[data-jump-wash]')!;
        const debug = window.__namiDebug?.();
        return {
          owner: debug?.owner,
          transitionId: debug?.transition?.id,
          transitionProgress: debug?.transition?.progress ?? 0,
          washOpacity: Number(getComputedStyle(washNode).opacity),
        };
      });

      expect(state.transitionId, `${id} at t=${point.t.toFixed(4)}`).toBe(id);
      expect(state.owner, `${id} owner at t=${point.t.toFixed(4)}`).toBe(point.expectedOwner);

      if (point.opaque) {
        expect(state.washOpacity, `${id} wash must be fully opaque at t=${point.t.toFixed(4)}`).toBe(1);
      } else {
        expect(state.washOpacity, `${id} wash must be < 1 outside opaque interval at t=${point.t.toFixed(4)}`).toBeLessThan(1);
      }
      if (point.washZero) {
        expect(state.washOpacity, `${id} wash must be 0 outside wash window at t=${point.t.toFixed(4)}`).toBe(0);
      }
    }

    // 3. Reverse traversal across swap + ε -> swap - ε flips owner back to `from` while wash stays opaque
    await seekJump(page, boundary, swap + EPSILON);
    await expect.poll(() => page.evaluate(() => window.__namiDebug?.().loading)).toBe(false);
    await expect(host).toHaveAttribute('data-scene', to);
    await expect.poll(() => page.evaluate(() => window.__namiDebug?.().owner)).toBe(to);

    await seekJump(page, boundary, swap - EPSILON);
    await expect.poll(() => page.evaluate(() => window.__namiDebug?.().loading)).toBe(false);
    await expect(host).toHaveAttribute('data-scene', from);
    await expect(wash).toHaveCSS('opacity', '1');
    await expect.poll(() => page.evaluate(() => window.__namiDebug?.().owner)).toBe(from);

    // 4. Jump end (t = 1) matches destination hero frame (b = 0)
    const jumpEnd = await captureAtJump(page, boundary, 1, { cold: false, clocks, includePng });
    const destHero = await captureAtBody(page, to, 0, clocks, { includePng });
    expect(jumpEnd.owner, `${id} t=1 owner`).toBe(to);
    expect(jumpEnd.hash, `${id} t=1 canvas matches ${to} b=0`).toBe(destHero.hash);
    if (includePng) {
      expect(jumpEnd.canvasSha256, `${id} t=1 PNG matches ${to} b=0`).toBe(destHero.canvasSha256);
    }
  }

  expect(errors).toEqual([]);
});
