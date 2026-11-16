import type { SceneId } from './contracts';

export type FactoryPosition = { scene: SceneId; local: number; scrollY: number };
export function createFactory() {
  let saved: FactoryPosition | null = null;
  return {
    open(position: FactoryPosition) { if (!saved) saved = position; },
    close() { const position = saved; saved = null; return position; },
  };
}
