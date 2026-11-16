import type { RobotDirective } from '../contracts';

export type IntroDirective = Extract<RobotDirective, { kind: 'clip' }>;
export const INTRO_END = 4.6;

export function createIntroClock() {
  let startedAt: number | null = null;
  let cancelled = false;
  return {
    get cancelled() { return cancelled; },
    cancel() { cancelled = true; },
    sample(now: number, reduced = false): number | undefined {
      if (reduced) cancelled = true;
      if (cancelled) return undefined;
      startedAt ??= now;
      const elapsed = now - startedAt - 0.15;
      if (elapsed >= INTRO_END) { cancelled = true; return undefined; }
      return elapsed;
    },
  };
}

export function sampleIntro(seconds: number, out: IntroDirective): IntroDirective {
  out.weight = 1;
  if (seconds < 0) { out.name = 'Sleep'; out.timeSeconds = 0; }
  else if (seconds < 1.2) { out.name = 'WakeUp'; out.timeSeconds = seconds; }
  else if (seconds < 1.8) { out.name = 'LookAround'; out.timeSeconds = seconds - 1; }
  else if (seconds >= 1.8 && seconds < 3.4) { out.name = 'Wave'; out.timeSeconds = seconds - 1.8; }
  else if (seconds < INTRO_END) { out.name = 'Draw'; out.timeSeconds = seconds - 3.4; }
  else { out.name = 'Idle'; out.timeSeconds = 0; }
  return out;
}
