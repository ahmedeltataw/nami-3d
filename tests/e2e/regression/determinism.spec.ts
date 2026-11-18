import { expect, test } from '@playwright/test';
import type { SceneId } from '../../../src/experience/contracts';
import { captureAtBody, captureAtJump, openCapturePage, setCaptureClocks } from './harness';

type SampleSpec =
  | { kind: 'body'; label: string; scene: SceneId; b: number; ambientTime: number; introTime: number }
  | { kind: 'jump'; label: string; boundary: number; t: number; ambientTime: number; introTime: number };

const DETERMINISM_SAMPLES: readonly SampleSpec[] = [
  { kind: 'body', label: 's01-intro-mid', scene: 's01', b: 0, ambientTime: 3.2, introTime: 1.8 },
  { kind: 'body', label: 's01-body-0.35', scene: 's01', b: 0.35, ambientTime: 6.4, introTime: 8 },
  { kind: 'jump', label: 'jump-0-t0.30', boundary: 0, t: 0.30, ambientTime: 6.4, introTime: 8 },
  { kind: 'jump', label: 'jump-0-t0.78', boundary: 0, t: 0.78, ambientTime: 6.4, introTime: 8 },
  { kind: 'body', label: 's02-body-0.50', scene: 's02', b: 0.50, ambientTime: 9.1, introTime: 8 },
  { kind: 'jump', label: 'jump-1-t0.30', boundary: 1, t: 0.30, ambientTime: 9.1, introTime: 8 },
  { kind: 'body', label: 's04-body-0.45', scene: 's04', b: 0.45, ambientTime: 4.5, introTime: 8 },
  { kind: 'jump', label: 'jump-4-t0.78', boundary: 4, t: 0.78, ambientTime: 7.2, introTime: 8 },
  { kind: 'body', label: 's07-body-0.40', scene: 's07', b: 0.40, ambientTime: 5.0, introTime: 8 },
];

test('determinism: same progress + same ambientTime/introTime produces byte-identical canvas capture across two runs', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));

  // Run 1: forward traversal through sample specs
  await openCapturePage(page, { locale: 'en', ambient: 3.2, intro: 1.8, hash: 's01' });
  const run1 = new Map<string, { canvasPng: Buffer; canvasSha256: string; hash: number; colorCount: number; snapshotJson: string }>();

  for (const spec of DETERMINISM_SAMPLES) {
    const sample = spec.kind === 'body'
      ? await captureAtBody(page, spec.scene, spec.b, { ambientTime: spec.ambientTime, introTime: spec.introTime })
      : await captureAtJump(page, spec.boundary, spec.t, { cold: true, clocks: { ambientTime: spec.ambientTime, introTime: spec.introTime } });
    expect(sample.colorCount, `${spec.label} should render non-blank WebGL content`).toBeGreaterThan(1);
    expect(sample.canvasPng.byteLength).toBeGreaterThan(1000);
    const snapshotJson = await page.evaluate(() => JSON.stringify({
      snapshot: window.__namiDebug?.().snapshot,
      transition: window.__namiDebug?.().transition,
      ambientTime: window.__namiDebug?.().ambientTime,
      introTime: window.__namiDebug?.().introTime,
    }));
    run1.set(spec.label, {
      canvasPng: sample.canvasPng,
      canvasSha256: sample.canvasSha256,
      hash: sample.hash,
      colorCount: sample.colorCount,
      snapshotJson,
    });
  }

  // Verify sensitivity: changing ambientTime on an ambient-driven scene (S04 jiggle) or progress changes the capture
  const s04AltAmbient = await captureAtBody(page, 's04', 0.45, { ambientTime: 6.1, introTime: 8 });
  expect(s04AltAmbient.canvasSha256).not.toBe(run1.get('s04-body-0.45')!.canvasSha256);

  // Run 2: fresh page load and reverse traversal with perturbed clocks before each sample
  await page.goto('about:blank');
  await openCapturePage(page, { locale: 'en', ambient: 0, intro: 0, hash: 's07' });

  for (const spec of [...DETERMINISM_SAMPLES].reverse()) {
    // Perturb clocks before restoring target capture inputs
    await setCaptureClocks(page, spec.ambientTime + 11.3, spec.introTime + 3.7);
    const sample = spec.kind === 'body'
      ? await captureAtBody(page, spec.scene, spec.b, { ambientTime: spec.ambientTime, introTime: spec.introTime })
      : await captureAtJump(page, spec.boundary, spec.t, { cold: true, clocks: { ambientTime: spec.ambientTime, introTime: spec.introTime } });
    const snapshotJson = await page.evaluate(() => JSON.stringify({
      snapshot: window.__namiDebug?.().snapshot,
      transition: window.__namiDebug?.().transition,
      ambientTime: window.__namiDebug?.().ambientTime,
      introTime: window.__namiDebug?.().introTime,
    }));
    const expected = run1.get(spec.label)!;
    expect(snapshotJson, `${spec.label} runtime snapshot must match`).toBe(expected.snapshotJson);
    expect(sample.hash, `${spec.label} raw RGBA pixel hash must match`).toBe(expected.hash);
    expect(sample.canvasSha256, `${spec.label} PNG SHA-256 must match`).toBe(expected.canvasSha256);
    expect(Buffer.compare(sample.canvasPng, expected.canvasPng), `${spec.label} canvas PNG bytes must be identical`).toBe(0);
  }

  expect(errors).toEqual([]);
});
