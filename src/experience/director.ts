export type DirectorState = 'idle' | 'playing' | 'paused' | 'step';
import { SCENE_IDS, TOTAL_BUDGET, unitsForScene } from './scroll-map';
import type { SceneId } from './contracts';
export function nextDirectorScene(scene: SceneId): SceneId | null {
  return SCENE_IDS[SCENE_IDS.indexOf(scene) + 1] ?? null;
}
export type DirectorAction = 'start' | 'pause' | 'resume' | 'exit' | 'manual';
export function directorReducer(state: DirectorState, action: DirectorAction, reduced = false): DirectorState {
  switch (action) {
    case 'start': return reduced ? 'step' : 'playing';
    case 'pause': return state === 'playing' ? 'paused' : state;
    case 'resume': return state === 'paused' ? 'playing' : state;
    case 'exit': case 'manual': return 'idle';
  }
}

export const DIRECTOR_VH_PER_SECOND = 40;
export function directorDuration(scene: SceneId) {
  const next = nextDirectorScene(scene);
  return ((next ? unitsForScene(next) : TOTAL_BUDGET) - unitsForScene(scene)) / DIRECTOR_VH_PER_SECOND * 1000;
}
