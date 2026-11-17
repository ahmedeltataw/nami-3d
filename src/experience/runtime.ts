import type { SceneId, SceneSnapshot, TransitionSnapshot, TransitionCtx } from './contracts';
import { createInteraction, createExploration } from './interaction';
import { createIntroClock } from './robot/intro';
import { createMotionClock } from './clocks';
import { scenes } from './scenes';
import { sampleBoundary, transitionAt } from './transitions';
import { ambientWeight, beatsFor } from './transitions/beats';
import { stationSeekLocal } from './scenes/s03/scene';
import { projectSeekLocal } from './scenes/s05/scene';

export function createRuntime() {
  const interaction = createInteraction();
  return {
    scene: 's01' as SceneId,
    local: 0,
    narrativeLocal: 0,
    b: 0,
    direction: 1,
    progress: 0,
    time: 0,
    clocks: createMotionClock(),
    ambientWeight: 1,
    replay: { b: 0, active: false },
    selection: { station: 1, project: 0 },
    loading: false,
    coldSeek: false,
    pointer: { x: 0, y: 0, active: false },
    headScreen: { x: 0, y: 0, radius: 0, visible: false },
    handScreen: { x: 0, y: 0 },
    cameraZ: 4.2,
    robotMeshes: 0,
    viewport: { w: 0, h: 0, dpr: 1.5 },
    interaction,
    exploration: createExploration(interaction),
    orbit: { yaw: 0, pitch: 0, distance: 4.3 },
    profile: { quality: 'mid', motion: 'full', renderer: 'webgl' } as import('./profile').Profile,
    snapshot: null as SceneSnapshot | null,
    presentationSnapshot: null as SceneSnapshot | null,
    transition: null as TransitionSnapshot | null,
    transitionContext: { intents: null } as TransitionCtx,
    sceneSnapshots: {} as Partial<Record<SceneId, SceneSnapshot>>,
    seekVersion: 0,
    contextLost: false,
    contextVersion: 0,
    assetsReady: false,
    framed: false,
    robotReady: false,
    intro: createIntroClock(),
    taskGaze: null as import('three').Vector3 | null,
  };
}
export type ExperienceRuntime = ReturnType<typeof createRuntime>;

// All narrative samplers receive the same explicit clock inputs. Loading never
// rewrites requested progress; presentation covers an unavailable frame instead.
export function evaluateRuntime(runtime: ExperienceRuntime) {
  const reduced = runtime.profile.motion === 'reduced';
  const jump = transitionAt(runtime.scene, runtime.narrativeLocal, reduced);
  runtime.ambientWeight = ambientWeight(jump?.progress ?? null, reduced, jump ? beatsFor(`${jump.definition.from}->${jump.definition.to}` as import('./contracts').TransitionId) : undefined);
  const times = runtime.clocks.value;
  const introSeconds = runtime.clocks.explicitIntro && runtime.scene === 's01' && runtime.b === 0
    ? times.introTime - .15 : runtime.intro.sample(times.introTime, reduced);
  const input = {
    local: reduced ? runtime.scene === 's03' ? stationSeekLocal(runtime.selection.station) : runtime.scene === 's05' ? projectSeekLocal(runtime.selection.project) : 0 : runtime.replay.active ? runtime.replay.b : runtime.b,
    narrativeLocal: runtime.narrativeLocal, viewport: runtime.viewport, profile: runtime.profile,
    interaction: runtime.interaction.state, seed: 1, ambient: times.ambientTime,
    ambientWeight: runtime.ambientWeight,
    introSeconds: runtime.scene === 's01' && runtime.b === 0 ? introSeconds : undefined,
  };
  const snapshot = scenes[runtime.scene].sample(input);
  const boundary = sampleBoundary(runtime.scene, input, snapshot);
  runtime.transition = boundary.transition;
  runtime.transitionContext.intents = boundary.transition;
  runtime.sceneSnapshots = boundary.snapshots;
  runtime.snapshot = boundary.transition ? boundary.snapshots[boundary.transition.owner]! : snapshot;
  return boundary;
}

export type ExperienceDebug = {
  scene: SceneId; local: number; progress: number; cameraZ: number; introCancelled: boolean;
  robotReady: boolean; robotMeshes: number; head: ExperienceRuntime['headScreen'];
  robot: SceneSnapshot['robot'] | undefined; reaction: string | undefined;
  transition: { id: string; progress: number } | null;
  mountedScenes: SceneId[];
  b: number; ambientTime: number; introTime: number; loading: boolean; owner: SceneId; snapshot: SceneSnapshot | null;
};
declare global { interface Window {
  __namiDebug?: () => ExperienceDebug;
  __namiCapture?: (times: import('./clocks').CaptureTimes | null) => void;
} }
