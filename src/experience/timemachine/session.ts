import type { SceneId } from '../contracts';
export type TimeMachinePosition = { scene: SceneId; local: number; scrollY: number; opener: HTMLElement | null; playing: boolean };
export function createTimeMachineSession() {
  let saved: TimeMachinePosition | null = null;
  return {
    open(position: TimeMachinePosition) { if (saved) return false; saved = position; return true; },
    close() { const position = saved; saved = null; return position; },
    get active() { return saved !== null; },
  };
}
