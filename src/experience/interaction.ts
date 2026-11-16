export type InteractionSource = 'scroll' | 'pointer' | 'drag' | 'director' | 'modal';
export type InteractionState = {
  source: InteractionSource | null;
  token: number;
  reaction: { name: string; startedAt: number; duration: number } | null;
};

const priority: Record<InteractionSource, number> = { pointer: 1, scroll: 2, drag: 3, director: 4, modal: 5 };

export function createInteraction() {
  const state: InteractionState = { source: null, token: 0, reaction: null };
  let cancel: (() => void) | undefined;
  function release(token = state.token) {
    if (token !== state.token) return;
    state.source = null;
    state.reaction = null;
    const previous = cancel;
    cancel = undefined;
    previous?.();
  }
  return {
    state,
    request(source: InteractionSource, onCancel?: () => void): number | null {
      if (state.source && priority[source] < priority[state.source]) return null;
      release();
      state.source = source;
      cancel = onCancel;
      return ++state.token;
    },
    release,
    narrativeChanged() { if (state.source !== 'director' && state.source !== 'modal') release(); },
    react(name: string, now: number, duration: number) {
      state.reaction = { name, startedAt: now, duration: Math.max(0, Math.min(duration, 1.2)) };
    },
    tick(now: number) {
      if (state.reaction && now - state.reaction.startedAt >= state.reaction.duration) state.reaction = null;
    },
  };
}

export function createExploration(interaction: ReturnType<typeof createInteraction>) {
  let token: number | null = null;
  return {
    get active() { return token !== null && interaction.state.token === token && interaction.state.source === 'drag'; },
    enter() { token = interaction.request('drag', () => { token = null; }); return token !== null; },
    exit() { if (token !== null) interaction.release(token); token = null; },
  };
}
