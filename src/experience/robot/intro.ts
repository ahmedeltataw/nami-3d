import type { RobotDirective } from '../contracts';

export type IntroDirective = Extract<RobotDirective, { kind: 'clip' }>;
export function sampleIntro(seconds: number, out: IntroDirective): IntroDirective {
  out.weight = 1;
  if (seconds < 0) { out.name = 'Sleep'; out.timeSeconds = 0; }
  else if (seconds < 1.2) { out.name = 'WakeUp'; out.timeSeconds = seconds; }
  else if (seconds >= 1.8 && seconds < 3.4) { out.name = 'Wave'; out.timeSeconds = seconds - 1.8; }
  else { out.name = 'Idle'; out.timeSeconds = 0; }
  return out;
}
