import { afterEach, describe, expect, it, vi } from 'vitest';
import { createController, SCENE_IDS, SCROLL_BUDGETS, TOTAL_BUDGET } from '../../src/experience/controller';
import { createRuntime } from '../../src/experience/runtime';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function environment(mobile = false, reduced = false, hash = '#s01') {
  let layoutHeight = 844;
  let reducedLayout = reduced;
  let offset = 0;
  const location = { hash };
  const entries: { hash: string; state: unknown }[] = [{ hash, state: { framework: true } }];
  let cursor = 0;
  const window = Object.assign(new EventTarget(), {
    innerWidth: mobile ? 390 : 1280,
    innerHeight: 844,
    scrollY: 0,
    scrollTo: vi.fn(({ top }: { top: number }) => { window.scrollY = Math.round(top); }),
  });
  function historyWrite(state: unknown, hash: string, push: boolean) {
    location.hash = hash;
    if (push) { entries.splice(cursor + 1); entries.push({ state, hash }); cursor++; }
    else entries[cursor] = { state, hash };
  }
  const history = {
    get state() { return entries[cursor].state; },
    scrollRestoration: 'auto',
    pushState: vi.fn((state: unknown, _title: string, hash: string) => historyWrite(state, hash, true)),
    replaceState: vi.fn((state: unknown, _title: string, hash: string) => historyWrite(state, hash, false)),
  };
  function start(index: number) {
    return offset + (reducedLayout ? index * window.innerHeight : SCROLL_BUDGETS.slice(0, index).reduce((sum, value) => sum + value, 0) * layoutHeight / 100);
  }
  const fonts = Object.assign(new EventTarget(), { ready: Promise.resolve() });
  const document = Object.assign(new EventTarget(), {
    fonts,
    body: {},
    documentElement: {
      dataset: {},
      style: { setProperty: (_name: string, value: string) => { layoutHeight = Number.parseFloat(value) * 100; } },
      get scrollHeight() { return offset + (reducedLayout ? 7 * window.innerHeight : TOTAL_BUDGET * layoutHeight / 100 + layoutHeight); },
    },
    getElementById(id: string) {
      const index = SCENE_IDS.indexOf(id as typeof SCENE_IDS[number]);
      return index < 0 ? null : { getBoundingClientRect: () => ({ top: start(index) - window.scrollY }) };
    },
  });
  vi.stubGlobal('window', window);
  vi.stubGlobal('document', document);
  vi.stubGlobal('location', location);
  vi.stubGlobal('history', history);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const runtime = createRuntime();
  const changed = vi.fn();
  const controller = createController(runtime, changed, reduced, mobile);
  controller.attach();
  return {
    runtime, window, document, history, controller, changed, location,
    shiftLayout(value: number) { offset = value; },
    changeMotion(value: boolean) {
      reducedLayout = value;
      window.scrollY = Math.min(window.scrollY, document.documentElement.scrollHeight - window.innerHeight);
      window.dispatchEvent(new Event('scroll'));
    },
    back() { cursor--; location.hash = entries[cursor].hash; window.dispatchEvent(new Event('popstate')); },
    forward() { cursor++; location.hash = entries[cursor].hash; window.dispatchEvent(new Event('popstate')); },
  };
}

describe('native controller lifecycle', () => {
  it('keeps the intro during layout measurement but cancels on actual scroll, even at local zero', async () => {
    const env = environment(false, false, '');
    await Promise.resolve();
    env.controller.recalculate();
    expect(env.runtime.intro.cancelled).toBe(false);
    env.controller.detach();
    expect(env.history.replaceState).not.toHaveBeenCalled();
    env.controller.attach();
    expect(env.runtime.intro.cancelled).toBe(false);
    env.controller.recalculate();
    env.changed.mockClear();
    env.window.dispatchEvent(new Event('scroll'));
    expect(env.runtime.intro.cancelled).toBe(true);
    expect(env.changed).toHaveBeenCalledWith(true);
    env.controller.detach();
  });

  it('preserves scene/local when a motion layout change scrolls before observers and effect cleanup', () => {
    const env = environment();
    env.controller.seek('s05', 0.4);
    for (const reduced of [true, false]) {
      env.changeMotion(reduced);
      expect([env.runtime.scene, env.runtime.local]).toEqual(['s05', 0.4]);
      const start = env.document.getElementById('s05')!.getBoundingClientRect().top;
      const span = (reduced ? 1 : 4.8) * env.window.innerHeight;
      expect(-start / span).toBeCloseTo(0.4, 2);
      expect(env.runtime.progress).toBeGreaterThanOrEqual(0);
      expect(env.runtime.progress).toBeLessThanOrEqual(1);
    }
    env.controller.detach();
    expect(env.history.state).toMatchObject({ __namiExperience: { scene: 's05', local: 0.4 } });
  });

  it('clamps native progress before the first scene and beyond the document', () => {
    const env = environment();
    env.shiftLayout(80);
    env.controller.recalculate();
    for (const y of [-200, 0, 79]) {
      env.window.scrollY = y;
      env.window.dispatchEvent(new Event('scroll'));
      expect([env.runtime.scene, env.runtime.local]).toEqual(['s01', 0]);
      expect(env.runtime.progress).toBeGreaterThanOrEqual(0);
      expect(env.runtime.progress).toBeLessThanOrEqual(1);
    }
    env.window.scrollY = 1e9;
    env.window.dispatchEvent(new Event('scroll'));
    expect([env.runtime.scene, env.runtime.local, env.runtime.progress]).toEqual(['s07', 1, 1]);
    env.controller.detach();
  });

  it('holds exact seek state through rounded scroll events at 140 fractional positions', () => {
    const env = environment(true);
    for (const scene of SCENE_IDS) for (let index = 0; index < 20; index++) {
      env.controller.seek(scene, index / 19);
      env.window.dispatchEvent(new Event('scroll'));
      expect(env.runtime.scene).toBe(scene);
      expect(env.runtime.local).toBe(index / 19);
      expect(env.location.hash).toBe(`#${scene}`);
    }
    env.controller.detach();
  });

  it('preserves fractional locals and existing framework state through history', () => {
    const env = environment();
    env.controller.seek('s03', 0.4);
    env.controller.seek('s05', 0.7);
    env.back();
    expect([env.runtime.scene, env.runtime.local]).toEqual(['s03', 0.4]);
    env.forward();
    expect([env.runtime.scene, env.runtime.local]).toEqual(['s05', 0.7]);
    expect(env.history.state).toMatchObject({ framework: true });
    env.controller.detach();
    expect(env.history.scrollRestoration).toBe('auto');
  });

  it('restores local progress on controller re-attach and from saved history', () => {
    const env = environment();
    env.controller.seek('s04', 0.6);
    env.controller.detach();
    env.runtime.local = 0;
    env.controller.attach();
    expect([env.runtime.scene, env.runtime.local]).toEqual(['s04', 0.6]);
    env.window.dispatchEvent(new Event('scroll'));
    expect(env.runtime.local).toBe(0.6);
    env.controller.detach();
  });

  it('debounces scroll history, flushes before navigation, and tolerates browser quotas', () => {
    vi.useFakeTimers();
    const env = environment();
    for (let index = 0; index < 120; index++) {
      env.window.scrollY = 100 + index;
      env.window.dispatchEvent(new Event('scroll'));
    }
    expect(env.history.replaceState).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(env.history.replaceState).toHaveBeenCalledOnce();
    env.window.scrollY = 400;
    env.window.dispatchEvent(new Event('scroll'));
    env.controller.seek('s04', 0.6);
    expect(env.history.replaceState).toHaveBeenCalledTimes(2);
    env.back();
    expect(env.runtime.scene).toBe('s01');
    expect(env.runtime.local).toBeCloseTo(400 / (844 * 1.8), 9);
    env.history.replaceState.mockImplementationOnce(() => { throw new DOMException('Quota', 'SecurityError'); });
    env.window.scrollY = 500;
    env.window.dispatchEvent(new Event('scroll'));
    expect(() => vi.advanceTimersByTime(200)).not.toThrow();
    env.controller.detach();
  });

  it('freezes mobile toolbar layout without issuing a scroll and keeps the tail reachable', () => {
    const env = environment(true);
    env.controller.seek('s05', 0.3);
    env.window.scrollTo.mockClear();
    env.window.innerHeight = 950;
    env.window.dispatchEvent(new Event('resize'));
    expect(env.runtime.viewport.h).toBe(844);
    expect(env.window.scrollTo).not.toHaveBeenCalled();
    env.window.scrollY = env.document.documentElement.scrollHeight - env.window.innerHeight;
    env.window.dispatchEvent(new Event('scroll'));
    expect([env.runtime.scene, env.runtime.local, env.runtime.progress]).toEqual(['s07', 1, 1]);
    env.window.innerWidth = 844;
    env.window.innerHeight = 390;
    env.window.dispatchEvent(new Event('orientationchange'));
    expect(env.runtime.viewport).toMatchObject({ w: 844, h: 390 });
    env.controller.detach();
  });

  it('recalculates fonts/layout and desktop resize while preserving scene/local', async () => {
    const env = environment();
    env.controller.seek('s04', 0.6);
    await Promise.resolve();
    env.shiftLayout(80);
    env.document.fonts.dispatchEvent(new Event('loadingdone'));
    expect([env.runtime.scene, env.runtime.local]).toEqual(['s04', 0.6]);
    env.window.innerHeight = 900;
    env.window.dispatchEvent(new Event('resize'));
    expect(env.runtime.viewport.h).toBe(900);
    expect([env.runtime.scene, env.runtime.local]).toEqual(['s04', 0.6]);
    env.controller.detach();
  });

  it('measures reduced-motion document flow instead of full budgets', () => {
    const env = environment(false, true, '#s05');
    expect(env.runtime.scene).toBe('s05');
    expect(env.window.scrollY).toBe(4 * 844);
    env.controller.seek('s06', 0.5);
    expect(env.window.scrollY).toBe(5.5 * 844);
    env.controller.detach();
  });
});
