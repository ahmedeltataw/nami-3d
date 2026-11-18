import type { SceneId } from './contracts';
import type { ExperienceRuntime } from './runtime';
import { noJumps } from './profile';

import { SCENE_IDS, SCROLL_BUDGETS, bodyProgress, localForBody } from './scroll-map';
export * from './scroll-map';
import { clamp } from './scroll-map';

export function sceneFromHash(hash: string): SceneId | null {
  const id = hash.replace(/^#/, '');
  return SCENE_IDS.includes(id as SceneId) ? id as SceneId : null;
}

export function createController(runtime: ExperienceRuntime, changed: (snap: boolean) => void, reducedMotion: boolean, mobile: boolean) {
  const jumpsDisabled = noJumps({ ...runtime.profile, motion: reducedMotion ? 'reduced' : 'full' });
  let viewportHeight = 0;
  let viewportWidth = 0;
  let starts: number[] = [];
  let spans: number[] = [];
  let measuredMax = 0;
  let attached = false;
  let resizeObserver: ResizeObserver | undefined;
  let snapped: { scene: SceneId; local: number; y: number } | null = null;
  let historyTimer: ReturnType<typeof setTimeout> | undefined;
  let pendingHistory: { scene: SceneId; local: number } | null = null;
  let pathname = '';
  let popHash: string | null = null;
  const previousRestoration = typeof history === 'undefined' ? 'auto' : history.scrollRestoration;

  function publish(scene: SceneId, local: number, progress: number, snap: boolean, exactBody?: number) {
    local = clamp(local);
    progress = clamp(progress);
    if (runtime.scene !== scene || runtime.narrativeLocal !== local || snap) runtime.interaction.narrativeChanged();
    runtime.scene = scene;
    runtime.narrativeLocal = local;
    runtime.local = exactBody ?? (jumpsDisabled ? local : bodyProgress(scene, local));
    runtime.b = reducedMotion ? 0 : runtime.local;
    runtime.progress = progress;
    if (snap) runtime.seekVersion++;
    changed(snap);
  }

  function onScroll(event?: Event, snap = false) {
    const cancelledIntro = !!event && !runtime.intro.cancelled;
    if (event) runtime.intro.cancel();
    if (!starts.length) return;
    // CSS/media changes can clamp scrollY before ResizeObserver or React effect cleanup.
    // Preserve narrative intent before interpreting that scroll against cached offsets.
    if (layoutChanged()) { measure(); return; }
    const y = window.scrollY;
    if (snapped && Math.abs(snapped.y - y) <= 1) {
      if (cancelledIntro) publish(runtime.scene, runtime.narrativeLocal, runtime.progress, true, runtime.local);
      return;
    }
    snapped = null;
    let index = SCENE_IDS.length - 1;
    for (let i = 0; i < starts.length; i++) {
      if (y < starts[i] + spans[i] - 0.5) { index = i; break; }
    }
    const local = clamp((y - starts[index]) / spans[index]);
    publish(SCENE_IDS[index], local, clamp(y / (starts[6] + spans[6])), snap);
    if (event) {
      pendingHistory = { scene: runtime.scene, local: runtime.local };
      clearTimeout(historyTimer);
      historyTimer = setTimeout(flushHistory, 200);
    }
  }

  function writeHistory(method: 'replaceState' | 'pushState', scene: SceneId, local: number, hash = `#${scene}`) {
    if (location.pathname !== pathname) return;
    const state: unknown = history.state;
    try {
      history[method]({ ...(typeof state === 'object' && state !== null ? state : {}), __namiExperience: { scene, local } }, '', hash);
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

  function seek(scene: SceneId, local = 0, updateHistory = true, cancelIntro = true) {
    const index = SCENE_IDS.indexOf(scene);
    if (!starts.length) return;
    if (cancelIntro) runtime.intro.cancel();
    const raw = jumpsDisabled ? clamp(local) : localForBody(scene, local);
    const y = starts[index] + spans[index] * raw;
    if (updateHistory) {
      flushHistory();
      writeHistory(location.hash === `#${scene}` && runtime.local === clamp(local) ? 'replaceState' : 'pushState', scene, clamp(local));
    }
    window.scrollTo({ top: y, behavior: 'instant' });
    snapped = { scene, local: clamp(local), y: window.scrollY };
    publish(scene, raw, clamp(y / (starts[6] + spans[6])), true, clamp(local));
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
    measuredMax = max;
    spans = starts.map((start, i) => Math.max(1, i === 6 ? Math.min(max - start, viewportHeight * SCROLL_BUDGETS[6] / 100) : starts[i + 1] - start));
    if (preserve) {
      const index = SCENE_IDS.indexOf(runtime.scene);
      const raw = runtime.narrativeLocal;
      const body = runtime.local;
      const y = starts[index] + spans[index] * raw;
      window.scrollTo({ top: y, behavior: 'instant' });
      snapped = { scene: runtime.scene, local: body, y: window.scrollY };
      publish(runtime.scene, raw, clamp(y / (starts[6] + spans[6])), true, body);
    }
  }

  function layoutChanged() {
    if (!starts.length) return true;
    const y = window.scrollY;
    return SCENE_IDS.some((id, index) => {
      const section = document.getElementById(id);
      return section && Math.abs(section.getBoundingClientRect().top + y - starts[index]) > 1;
    }) || Math.abs(document.documentElement.scrollHeight - window.innerHeight - measuredMax) > 1;
  }

  function onResize() {
    if (mobile && window.innerWidth === viewportWidth) {
      // Browser chrome changes the visible area, not the frozen scene layout or camera intent.
      if (starts.length) { measuredMax = document.documentElement.scrollHeight - window.innerHeight; spans[6] = Math.max(1, Math.min(measuredMax - starts[6], viewportHeight * SCROLL_BUDGETS[6] / 100)); }
      return;
    }
    measure();
  }
  function onOrientation() { measure(true, true); }
  function savedLocal(scene: SceneId) {
    const saved = history.state?.__namiExperience;
    return saved?.scene === scene && typeof saved.local === 'number' ? clamp(saved.local) : 0;
  }
  function onHistory(event: Event) {
    if (event.type === 'hashchange' && popHash === location.hash) { popHash = null; return; }
    popHash = event.type === 'popstate' ? location.hash : null;
    clearHistory();
    const scene = sceneFromHash(location.hash);
    seek(scene ?? 's01', scene && event.type === 'popstate' ? savedLocal(scene) : 0, false);
    focusHeading(scene ?? 's01');
  }
  function onClick(event: MouseEvent) {
    const target = event.target;
    if (!(target instanceof Element) || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = target.closest('a');
    if (!link || link.target || link.hasAttribute('download')) return;
    const url = new URL(link.href, location.href);
    const scene = url.hash === '#main' ? 's01' : sceneFromHash(url.hash);
    if (scene && url.origin === location.origin && url.pathname === location.pathname && (url.search === location.search || !url.search)) {
      event.preventDefault();
      if (url.hash === '#main') {
        flushHistory();
        seek(scene, 0, false);
        writeHistory('pushState', scene, 0, '#main');
      } else seek(scene);
      focusHeading(scene);
    }
  }
  function focusHeading(scene: SceneId) {
    const heading = document.querySelector?.<HTMLElement>(`[data-overlay-scene="${scene}"] h1, [data-overlay-scene="${scene}"] h2`) ?? document.getElementById(scene)?.querySelector?.<HTMLElement>('h1, h2, [role=heading]');
    if (heading) {
      const panel = heading.closest?.<HTMLElement>('[data-scene-panel]');
      if (panel) { panel.dataset.active = 'true'; panel.inert = false; }
      heading.tabIndex = -1; heading.focus({ preventScroll: true });
    }
  }
  function onKey(event: KeyboardEvent) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || !(event.target instanceof Element)
      || runtime.interaction.state.source === 'modal' || document.body.style?.overflow === 'hidden'
      || event.target.closest('input, textarea, select, button, a, [contenteditable=true], dialog, [role="dialog"], [role="slider"], #mobile-nav-panel')) return;
    const index = SCENE_IDS.indexOf(runtime.scene);
    const target = event.key === 'Home' ? SCENE_IDS[0] : event.key === 'End' ? SCENE_IDS[6] : event.key === 'PageDown' ? SCENE_IDS[Math.min(6, index + 1)] : event.key === 'PageUp' ? SCENE_IDS[Math.max(0, index - 1)] : null;
    if (!target) return;
    event.preventDefault(); seek(target); focusHeading(target);
  }
  function onFonts() { if (attached) measure(); }

  return {
    seek,
    position: () => ({ scene: runtime.scene, local: runtime.local }),
    hero(scene: SceneId) { seek(scene); focusHeading(scene); },
    scrollToProgress(progress: number, snap = false) {
      window.scrollTo({ top: clamp(progress) * (starts[6] + spans[6]), behavior: 'instant' });
      onScroll(undefined, snap);
      snapped = { scene: runtime.scene, local: runtime.local, y: window.scrollY };
    },
    recalculate: () => measure(),
    attach(initialAttach = true) {
      attached = true;
      pathname = location.pathname;
      history.scrollRestoration = 'manual';
      document.documentElement.dataset.motion = reducedMotion ? 'reduced' : 'full';
      measure(false);
      const scene = sceneFromHash(location.hash);
      if (scene) {
        const focusEntry = initialAttach && !history.state?.__namiExperience;
        seek(scene, savedLocal(scene), false);
        if (focusEntry) focusHeading(scene);
      } else onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onResize);
      window.addEventListener('orientationchange', onOrientation);
      window.addEventListener('popstate', onHistory);
      window.addEventListener('hashchange', onHistory);
      window.addEventListener('pagehide', flushHistory);
      document.addEventListener('click', onClick);
      document.addEventListener('keydown', onKey);
      document.fonts.ready.then(onFonts);
      document.fonts.addEventListener('loadingdone', onFonts);
      resizeObserver = new ResizeObserver(() => { if (layoutChanged()) measure(); });
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
      document.removeEventListener('keydown', onKey);
      document.fonts.removeEventListener('loadingdone', onFonts);
      resizeObserver?.disconnect();
    },
  };
}

declare global { interface Window { __namiController?: ReturnType<typeof createController> } }
