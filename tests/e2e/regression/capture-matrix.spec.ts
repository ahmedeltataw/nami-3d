import { expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { captureJumpFrames, DEFAULT_JUMP_T, JUMPS, openCapturePage } from './harness';

// Tagged @gpu so default `pnpm test:e2e` (--grep-invert @gpu) skips the heavy full-matrix PNG capture run.
test('full jump capture matrix writes forward, reverse and direct-seek frames for all jumps @gpu', async ({ page }) => {
  test.setTimeout(300_000);
  await openCapturePage(page, { locale: 'en', ambient: 6, intro: 8, hash: 's01', viewport: { width: 1280, height: 800 } });

  for (const jump of JUMPS) {
    const manifest = await captureJumpFrames(page, jump, {
      ambientTime: 6,
      introTime: 8,
      outDir: 'captures',
    });
    expect(manifest.frames).toHaveLength(DEFAULT_JUMP_T.length * 3);
    expect(manifest.parity.allMatch, `${jump.id} forward/reverse/direct-seek parity`).toBe(true);
    expect(existsSync(join('captures', jump.slug, 'manifest.json'))).toBe(true);
  }
});
