import { expect, type Page } from '@playwright/test';
import type { SceneId, TransitionId } from '../../../src/experience/contracts';
import { SCENE_IDS, SCROLL_MAP, TOTAL_BUDGET, unitsForScene } from '../../../src/experience/scroll-map';
import { beatsFor } from '../../../src/experience/transitions/beats';
import { seekJump } from '../motion-helpers';
import {
  captureJumpFrames,
  DEFAULT_JUMP_T,
  JUMPS,
  waitForSettledFrame,
  type SettledFrameSample,
} from '../../../scripts/capture-jumps.mjs';

export {
  captureJumpFrames,
  DEFAULT_JUMP_T,
  JUMPS,
  type SettledFrameSample,
};

export type CaptureOpenOptions = {
  locale?: 'en' | 'ar';
  ambient?: number;
  intro?: number;
  hash?: SceneId;
  viewport?: { width: number; height: number };
};

export async function openCapturePage(page: Page, options: CaptureOpenOptions = {}) {
  const locale = options.locale ?? 'en';
  const ambient = options.ambient ?? 6;
  const intro = options.intro ?? 8;
  const hash = options.hash ?? 's01';
  const viewport = options.viewport ?? { width: 640, height: 400 };
  await page.setViewportSize(viewport);
  await page.goto(`/${locale}?capture=1&ambient=${ambient}&intro=${intro}&experienceDebug=1#${hash}`);
  const host = page.locator('[data-experience]');
  await expect(host).toHaveAttribute('data-ready', 'true', { timeout: 45_000 });
  await waitForSettledFrame(page, [hash], { includePng: false });
}

export async function setCaptureClocks(page: Page, ambientTime: number, introTime: number) {
  await page.evaluate(
    ({ ambient, intro }) => {
      window.__namiCapture?.({ ambientTime: ambient, introTime: intro });
    },
    { ambient: ambientTime, intro: introTime },
  );
}

export async function captureAtBody(
  page: Page,
  scene: SceneId,
  b: number,
  clocks?: { ambientTime: number; introTime: number },
  options: { includePng?: boolean } = {},
): Promise<SettledFrameSample> {
  if (clocks) await setCaptureClocks(page, clocks.ambientTime, clocks.introTime);
  const progress = unitsForScene(scene, b) / TOTAL_BUDGET;
  await page.evaluate(targetProgress => {
    window.__namiController?.scrollToProgress(targetProgress, true);
  }, progress);
  const index = SCENE_IDS.indexOf(scene);
  const expectedMounted = b >= 1 && index < SCENE_IDS.length - 1 ? [scene, SCENE_IDS[index + 1]] : [scene];
  return waitForSettledFrame(page, expectedMounted, options);
}

export async function captureAtJump(
  page: Page,
  boundary: number,
  t: number,
  options: { cold?: boolean; clocks?: { ambientTime: number; introTime: number }; includePng?: boolean } = {},
): Promise<SettledFrameSample> {
  if (options.clocks) await setCaptureClocks(page, options.clocks.ambientTime, options.clocks.introTime);
  const from = SCENE_IDS[boundary];
  const to = SCENE_IDS[boundary + 1];
  await seekJump(page, boundary, t, Boolean(options.cold));
  const expectedMounted = t >= 1 ? [to] : [from, to];
  return waitForSettledFrame(page, expectedMounted, { includePng: options.includePng });
}

export function boundaryBeats(boundary: number) {
  const from = SCENE_IDS[boundary];
  const to = SCENE_IDS[boundary + 1];
  const id = `${from}->${to}` as TransitionId;
  const beats = beatsFor(id);
  const swap = (beats.opaque[0] + beats.opaque[1]) / 2;
  return { boundary, id, from, to, row: SCROLL_MAP[boundary], nextRow: SCROLL_MAP[boundary + 1], beats, swap };
}
