import type { SceneId } from './contracts';

export const SCENE_IDS: readonly SceneId[] = ['s01', 's02', 's03', 's04', 's05', 's06', 's07'];
export const SCROLL_BUDGETS = [180, 240, 540, 320, 480, 420, 100] as const;
export const TOTAL_BUDGET = SCROLL_BUDGETS.reduce((sum, value) => sum + value, 0);
export const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
export type BoundaryLength = { head: number; tail: number };
export const BOUNDARY_LENGTHS: readonly BoundaryLength[] = SCENE_IDS.slice(1).map(() => ({ head: 55, tail: 55 }));

export function createScrollMap(lengths: readonly BoundaryLength[] = BOUNDARY_LENGTHS) {
  let start = 0;
  return SCENE_IDS.map((id, index) => {
    const budget = SCROLL_BUDGETS[index];
    const tail = index ? lengths[index - 1].tail : 0;
    const head = index < 6 ? lengths[index].head : 0;
    if (tail < 0 || head < 0 || tail + head >= budget) throw new Error(`Invalid scroll allocation: ${id}`);
    const row = { id, start, budget, tail, body: budget - tail - head, head, hero: start + tail, departure: start + budget - head };
    start += budget;
    return row;
  });
}
export const SCROLL_MAP = createScrollMap();
export function bodyProgress(scene: SceneId, local: number) {
  const row = SCROLL_MAP[SCENE_IDS.indexOf(scene)];
  const units = clamp(local) * row.budget - row.tail;
  return Math.abs(units) < 1e-10 ? 0 : Math.abs(units - row.body) < 1e-10 ? 1 : clamp(units / row.body);
}
export function localForBody(scene: SceneId, b: number) {
  const row = SCROLL_MAP[SCENE_IDS.indexOf(scene)];
  return (row.tail + row.body * clamp(b)) / row.budget;
}
export function unitsForScene(scene: SceneId, b = 0) {
  const row = SCROLL_MAP[SCENE_IDS.indexOf(scene)];
  return row.hero + row.body * clamp(b);
}
export function mapUnits(units: number) {
  const u = Math.max(0, Math.min(TOTAL_BUDGET, Number.isFinite(units) ? units : 0));
  const row = SCROLL_MAP.find(row => u < row.start + row.budget) ?? SCROLL_MAP[6];
  const local = clamp((u - row.start) / row.budget);
  const b = bodyProgress(row.id, local);
  const phase: 'tail' | 'body' | 'head' = u < row.hero ? 'tail' : u >= row.departure && row.head ? 'head' : 'body';
  const boundary = phase === 'tail' ? SCENE_IDS.indexOf(row.id) - 1 : SCENE_IDS.indexOf(row.id);
  const a = SCROLL_MAP[boundary];
  const next = SCROLL_MAP[boundary + 1];
  const t = phase === 'body' || !next ? null : clamp((u - a.departure) / (a.head + next.tail));
  return { scene: row.id, local, b, t, phase, progress: u / TOTAL_BUDGET };
}
export type ScrollPosition = ReturnType<typeof mapUnits>;
export function mapScroll(scrollY: number, viewportHeight: number): ScrollPosition {
  return mapUnits(scrollY / Math.max(1, viewportHeight) * 100);
}
export function scrollForScene(scene: SceneId, b: number, viewportHeight: number) {
  return unitsForScene(scene, b) * viewportHeight / 100;
}
