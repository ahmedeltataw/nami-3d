import { expect, test } from '@playwright/test';
import { SCENE_IDS } from '../../../src/experience/scroll-map';
import { scrollBody } from '../motion-helpers';
import { captureAtJump, JUMPS, openCapturePage, setCaptureClocks, type SettledFrameSample } from './harness';

const COLD_SEEK_T = [0.30, 0.55, 0.78] as const;

test('cold seek into every jump at t = .30 / .55 / .78 renders the same frame as scrolling there', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  const clocks = { ambientTime: 6, introTime: 8 };
  await openCapturePage(page, { locale: 'en', ambient: clocks.ambientTime, intro: clocks.introTime, hash: 's01' });

  // Pass 1: Continuous forward scroll through each scene body into each jump at t = .30, .55, .78
  const scrolled = new Map<string, SettledFrameSample>();
  for (const jump of JUMPS) {
    const from = SCENE_IDS[jump.boundary];
    await setCaptureClocks(page, clocks.ambientTime, clocks.introTime);
    await scrollBody(page, from, 0.9);
    await scrollBody(page, from, 0.98);
    for (const t of COLD_SEEK_T) {
      const sample = await captureAtJump(page, jump.boundary, t, { cold: false, clocks, includePng: t === 0.30 });
      expect(sample.colorCount, `${jump.id} scrolled at t=${t} should not be blank`).toBeGreaterThan(1);
      scrolled.set(`${jump.id}@${t.toFixed(2)}`, sample);
    }
  }

  // Pass 2: Cold seek into every jump in non-adjacent order [0, 3, 1, 4, 2, 5] so neither from nor to is mounted before the seek
  const coldJumpOrder = [0, 3, 1, 4, 2, 5].map(idx => JUMPS[idx]);
  for (const jump of coldJumpOrder) {
    const mountedBefore = await page.evaluate(() => window.__namiDebug?.().mountedScenes ?? []);
    expect(mountedBefore, `${jump.id} from (${jump.from}) must not be mounted before cold seek`).not.toContain(jump.from);
    expect(mountedBefore, `${jump.id} to (${jump.to}) must not be mounted before cold seek`).not.toContain(jump.to);

    // Rotate entry order per boundary so .30, .55, and .78 are each hit first from an unmounted state
    const rotated = COLD_SEEK_T.map((_, idx) => COLD_SEEK_T[(idx + jump.boundary) % COLD_SEEK_T.length]);
    for (const t of rotated) {
      const key = `${jump.id}@${t.toFixed(2)}`;
      const includePng = t === 0.30;
      const coldSample = await captureAtJump(page, jump.boundary, t, { cold: true, clocks, includePng });
      const expected = scrolled.get(key)!;

      expect(coldSample.owner, `${key} owner`).toBe(expected.owner);
      expect(coldSample.scene, `${key} scene`).toBe(expected.scene);
      expect(coldSample.cameraZ, `${key} cameraZ`).toBeCloseTo(expected.cameraZ, 5);
      expect(coldSample.washOpacity, `${key} washOpacity`).toBeCloseTo(expected.washOpacity, 3);
      expect(coldSample.hash, `${key} RGBA pixel hash must match scrolled frame`).toBe(expected.hash);
      if (includePng) {
        expect(coldSample.canvasSha256, `${key} canvas PNG SHA-256 must match scrolled frame`).toBe(expected.canvasSha256);
        expect(Buffer.compare(coldSample.canvasPng, expected.canvasPng), `${key} canvas PNG bytes must match`).toBe(0);
      }
    }
  }

  expect(errors).toEqual([]);
});
