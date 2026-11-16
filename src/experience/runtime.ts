import type { SceneId, SceneSnapshot } from './contracts';
import { createInteraction } from './interaction';
import { createIntroClock } from './robot/intro';

export function createRuntime() {
  return {
    scene: 's01' as SceneId,
    local: 0,
    progress: 0,
    time: 0,
    pointer: { x: 0, y: 0, active: false },
    headScreen: { x: 0, y: 0, radius: 0, visible: false },
    handScreen: { x: 0, y: 0 },
    cameraZ: 4.2,
    robotMeshes: 0,
    viewport: { w: 0, h: 0, dpr: 1.5 },
    interaction: createInteraction(),
    snapshot: null as SceneSnapshot | null,
    seekVersion: 0,
    contextLost: false,
    assetsReady: false,
    framed: false,
    robotReady: false,
    intro: createIntroClock(),
    taskGaze: null as import('three').Vector3 | null,
  };
}
export type ExperienceRuntime = ReturnType<typeof createRuntime>;

export type ExperienceDebug = {
  scene: SceneId; local: number; cameraZ: number; introCancelled: boolean;
  robotReady: boolean; robotMeshes: number; head: ExperienceRuntime['headScreen'];
  robot: SceneSnapshot['robot'] | undefined; reaction: string | undefined;
};
declare global { interface Window { __namiDebug?: () => ExperienceDebug } }
