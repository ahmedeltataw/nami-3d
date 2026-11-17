import type { Page } from '@playwright/test';
import type { SceneId } from '../../src/experience/contracts';
import { localForBody, SCROLL_MAP, TOTAL_BUDGET } from '../../src/experience/scroll-map';

export async function scrollBody(page: Page, scene: SceneId, b: number) {
  await page.evaluate(({ scene, b, local }) => {
    const section = document.getElementById(scene)!;
    const raw = document.documentElement.dataset.motion === 'reduced' ? b : local;
    window.scrollTo({ top: section.offsetTop + section.offsetHeight * raw, behavior: 'instant' });
  }, { scene, b, local: localForBody(scene, b) });
}
export async function seekJump(page: Page, boundary: number, t: number, cold = false) {
  const row = SCROLL_MAP[boundary];
  const length = row.head + SCROLL_MAP[boundary + 1].tail;
  await page.evaluate(({ progress, cold }) => {
    window.__namiController!.scrollToProgress(progress, cold);
  }, { progress: (row.departure + t * length) / TOTAL_BUDGET, cold });
}
