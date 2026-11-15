import type { SceneId } from './contracts';
import type { ExperienceRuntime } from './runtime';

export const SCENE_IDS: readonly SceneId[] = ['s01', 's02', 's03', 's04', 's05', 's06', 's07'];
export const SCROLL_BUDGETS = [180, 240, 540, 320, 480, 420, 100] as const;
export const TOTAL_BUDGET = SCROLL_BUDGETS.reduce((sum, value) => sum + value, 0);
export type ScrollPosition = { scene: SceneId; local: number; progress: number };
export const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export function mapScroll(scrollY: number, viewportHeight: number): ScrollPosition {
  const units = clamp(scrollY / (Math.max(1, viewportHeight) * TOTAL_BUDGET / 100)) * TOTAL_BUDGET;
  let start = 0;
  for (let index = 0; index < SCENE_IDS.length; index++) {
    const end = start + SCROLL_BUDGETS[index];
    if (units < end || index === SCENE_IDS.length - 1) {
      return { scene: SCENE_IDS[index], local: clamp((units - start) / SCROLL_BUDGETS[index]), progress: units / TOTAL_BUDGET };
    }
    start = end;
  }
  throw new Error('Unreachable scroll interval');
}

export function scrollForScene(scene: SceneId, local: number, viewportHeight: number): number {
  const index = SCENE_IDS.indexOf(scene);
  return (SCROLL_BUDGETS.slice(0, index).reduce((sum, value) => sum + value, 0) + SCROLL_BUDGETS[index] * clamp(local)) * viewportHeight / 100;
}

export function sceneFromHash(hash: string): SceneId | null {
  const id = hash.replace(/^#/, '');
  return SCENE_IDS.includes(id as SceneId) ? id as SceneId : null;
}

export function createController(runtime: ExperienceRuntime, changed: (snap: boolean) => void, reducedMotion: boolean, mobile: boolean) {
  let viewportHeight = 0;
  let viewportWidth = 0;
  let starts: number[] = [];
  let spans: number[] = [];
  let attached = false;
  let resizeObserver: ResizeObserver | undefined;
  let snapped: { scene: SceneId; local: number; y: number } | null = null;
  let historyTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingHistory: { scene: SceneId; local: number } | null = null;
  let pathname = '';
  const previousRestoration = typeof history === 'undefined' ? 'auto' : history.scrollRestoration;

  function publish(scene: SceneId, local: number, progress: number, snap: boolean) {
    if (runtime.scene !== scene || runtime.local !== local || snap) runtime.interaction.narrativeChanged();
    runtime.scene = scene;
    runtime.local = local;
    runtime.progress = progress;
    if (snap) runtime.seekVersion++;
    changed(snap);
  }

  function onScroll() {
    if (!starts.length) return;
    const y = window.scrollY;
    if (snapped && Math.abs(snapped.y - y) <= 1) return;
    snapped = null;
    let index = SCENE_IDS.length - 1;
    for (let i = 0; i < starts.length; i++) {
      if (y < starts[i] + spans[i] - 0.5) { index = i; break; }
    }
    const local = clamp((y - starts[index]) / spans[index]);
    publish(SCENE_IDS[index], local, clamp(y / (starts[6] + spans[6])), false);
    pendingHistory = { scene: runtime.scene, local };
    clearTimeout(historyTimer);
    historyTimer = setTimeout(flushHistory, 200);
  }

  function writeHistory(method: 'replaceState' | 'pushState', scene: SceneId, local: number) {
    if (location.pathname !== pathname) return;
    const state: unknown = history.state;
    try {
      history[method]({ ...(typeof state === 'object' && state !== null ? state : {}), __namiExperience: { scene, local } }, '', `#${scene}`);
    } catch (error) {
      // WebKit can rate-limit history writes; native scrolling and the narrative must continue.
      if (!(error instanceof DOMException) || error.name !== 'SecurityError') throw error;
    }
  }

  function clearHistory() {
    clearTimeout(historyTimer);
    historyTimer = undefined;
    pendingHistory = null;
  }

  function flushHistory() {
    if (!pendingHistory) return;
    const pending = pendingHistory;
    clearHistory();
    writeHistory('replaceState', pending.scene, pending.local);
  }

  function savedLocal(scene: SceneId): number {
    const state: unknown = history.state;
    const saved = typeof state === 'object' && state !== null && '__namiExperience' in state ? state.__namiExperience : null;
    if (typeof saved === 'object' && saved !== null && 'scene' in saved && saved.scene === scene && 'local' in saved && typeof saved.local === 'number') return clamp(saved.local);
    return runtime.scene === scene ? runtime.local : 0;
  }

  function seek(scene: SceneId, local = 0, updateHistory = true) {
    const index = SCENE_IDS.indexOf(scene);
    if (!starts.length) return;
    const y = starts[index] + spans[index] * clamp(local);
    if (updateHistory) {
      flushHistory();
      writeHistory(location.hash === `#${scene}` && runtime.local === clamp(local) ? 'replaceState' : 'pushState', scene, clamp(local));
    }
    window.scrollTo({ top: y, behavior: 'instant' });
    snapped = { scene, local: clamp(local), y: window.scrollY };
    publish(scene, clamp(local), clamp(y / (starts[6] + spans[6])), true);
  }

  function measure(preserve = true, force = false) {
    const width = window.innerWidth;
    if (force || !viewportHeight || !mobile || width !== viewportWidth) {
      viewportHeight = window.innerHeight;
      viewportWidth = width;
      document.documentElement.style.setProperty('--experience-vh', `${viewportHeight / 100}px`);
    }
    runtime.viewport.w = width;
    runtime.viewport.h = viewportHeight;
    const elements = SCENE_IDS.map(id => document.getElementById(id));
    if (elements.some(element => !element)) { starts = []; spans = []; return; }
    starts = elements.map(element => element!.getBoundingClientRect().top + window.scrollY);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    spans = starts.map((start, i) => Math.max(1, i === 6 ? max - start : starts[i + 1] - start));
    if (preserve) seek(runtime.scene, runtime.local, false);
  }

  function onResize() {
    if (mobile && window.innerWidth === viewportWidth) {
      // Browser chrome changes the visible area, not the frozen scene layout or camera intent.
      if (starts.length) spans[6] = Math.max(1, document.documentElement.scrollHeight - window.innerHeight - starts[6]);
      return;
    }
    measure();
  }
  function onOrientation() { measure(true, true); }
  function onHistory() {
    clearHistory();
    const scene = sceneFromHash(location.hash);
    seek(scene ?? 's01', scene ? savedLocal(scene) : 0, false);
  }
  function onClick(event: MouseEvent) {
    const target = event.target;
    if (!(target instanceof Element) || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = target.closest('a');
    if (!link || link.target || link.hasAttribute('download')) return;
    const url = new URL(link.href, location.href);
    const scene = sceneFromHash(url.hash);
    if (scene && url.origin === location.origin && url.pathname === location.pathname && url.search === location.search) {
      event.preventDefault();
      seek(scene);
    }
  }
  function onFonts() { if (attached) measure(); }

  return {
    seek,
    recalculate: () => measure(),
    attach() {
      attached = true;
      pathname = location.pathname;
      history.scrollRestoration = 'manual';
      document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'full';
      measure(false);
      const scene = sceneFromHash(location.hash);
      if (scene) seek(scene, savedLocal(scene), false); else onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onResize);
      window.addEventListener('orientationchange', onOrientation);
      window.addEventListener('popstate', onHistory);
      window.addEventListener('hashchange', onHistory);
      window.addEventListener('pagehide', flushHistory);
      document.addEventListener('click', onClick);
      document.fonts.ready.then(onFonts);
      document.fonts.addEventListener('loadingdone', onFonts);
      resizeObserver = new ResizeObserver(() => {
        if (SCENE_IDS.some((id, index) => {
          const section = document.getElementById(id);
          return section && Math.abs(section.getBoundingClientRect().top + window.scrollY - starts[index]) > 1;
        })) measure();
      });
      resizeObserver.observe(document.body);
    },
    detach() {
      flushHistory();
      attached = false;
      history.scrollRestoration = previousRestoration;
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onOrientation);
      window.removeEventListener('popstate', onHistory);
      window.removeEventListener('hashchange', onHistory);
      window.removeEventListener('pagehide', flushHistory);
      document.removeEventListener('click', onClick);
      document.fonts.removeEventListener('loadingdone', onFonts);
      resizeObserver?.disconnect();
    },
  };
}
