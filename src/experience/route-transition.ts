export type TransitionPhase = 'idle' | 'cover' | 'switch' | 'reveal';

export function createRouteTransition(notify: (phase: TransitionPhase) => void) {
  let generation = 0;
  let phase: TransitionPhase = 'idle';
  const set = (next: TransitionPhase) => { phase = next; notify(next); };
  return {
    get phase() { return phase; },
    start() { generation++; set('cover'); return generation; },
    covered(token: number) { if (token !== generation || phase !== 'cover') return false; set('switch'); return true; },
    reveal(token: number) { if (token === generation && phase !== 'idle') set('reveal'); },
    finish(token: number) { if (token === generation) set('idle'); },
    cancel() { generation++; set('idle'); },
  };
}
