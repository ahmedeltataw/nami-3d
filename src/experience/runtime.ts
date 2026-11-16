import type { SceneId, SceneSnapshot } from './contracts';
import { createInteraction } from './interaction';

export function createRuntime() {
  return {
    scene: 's01' as SceneId,
    local: 0,
    progress: 0,
    time: 0,
    pointer: { x: 0, y: 0 },
    viewport: { w: 0, h: 0, dpr: 1.5 },
    interaction: createInteraction(),
    snapshot: null as SceneSnapshot | null,
    seekVersion: 0,
    contextLost: false,
    assetsReady: false,
    framed: false,
    robotReady: false,
    introStartedAt: -1,
    introCancelled: false,
    taskGaze: null as import('three').Vector3 | null,
  };
}
export type ExperienceRuntime = ReturnType<typeof createRuntime>;
