import { INTRO_END } from './robot/intro';
export type CaptureTimes = { ambientTime: number; introTime: number; introExplicit?: boolean };
export function captureTimes(search: string): CaptureTimes | null {
  const params = new URLSearchParams(search);
  if (params.get('capture') !== '1') return null;
  const value = (key: string) => { const n = Number(params.get(key) ?? 0); return Number.isFinite(n) ? Math.max(0, n) : 0; };
  return { ambientTime: value('ambient'), introTime: params.has('intro') ? value('intro') : INTRO_END + .15, introExplicit: params.has('intro') };
}
export function createMotionClock() {
  const value = { ambientTime: 0, introTime: 0 };
  let explicit: CaptureTimes | null = null;
  return {
    get capture() { return explicit !== null; },
    get explicitIntro() { return explicit !== null && explicit.introExplicit !== false; },
    get value() { return explicit ?? value; },
    setCapture(times: CaptureTimes | null) { explicit = times ? { ambientTime: Math.max(0, times.ambientTime), introTime: Math.max(0, times.introTime), ...(times.introExplicit === undefined ? {} : { introExplicit: times.introExplicit }) } : null; },
    tick(delta: number, reduced: boolean, introRunning: boolean) {
      if (explicit) return explicit;
      const step = Math.min(.1, Math.max(0, Number.isFinite(delta) ? delta : 0));
      if (!reduced) {
        value.ambientTime += step;
        if (introRunning) value.introTime += step;
      }
      return value;
    },
  };
}
