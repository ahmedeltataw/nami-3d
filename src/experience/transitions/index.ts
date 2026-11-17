import type { SampleInput, SceneId, SceneSnapshot, TransitionDef, TransitionId, TransitionSnapshot } from '../contracts';
import { bodyProgress, clamp, SCENE_IDS, SCROLL_MAP } from '../scroll-map';
import { scenes } from '../scenes';
import { beatsFor, jumpOwnership, ramp } from './beats';
import { ease } from '../ease';
import { blendRobotPlacement, robotPlacement } from '../robot/placement';

function boundary(from: SceneId, to: SceneId): TransitionDef {
  const a = SCROLL_MAP[SCENE_IDS.indexOf(from)];
  const b = SCROLL_MAP[SCENE_IDS.indexOf(to)];
  const id = `${from}->${to}` as TransitionId;
  return {
    from, to, window: [(a.budget - a.head) / a.budget, b.tail / b.budget],
    sample(t, input) {
      t = clamp(t);
      const beats = beatsFor(id);
      const ownership = jumpOwnership(from, to, t, beats);
      const snapshot = ownership.owner === from ? input.from : input.to;
      const lens = snapshot.camera;
      // Lens, fog and light ownership change together beneath the opaque wash.
      const camera = {
        from: { ...input.from.camera, fov: lens.fov, near: lens.near, far: lens.far },
        to: { ...input.to.camera, fov: lens.fov, near: lens.near, far: lens.far },
        blend: ease('power2.inOut', t),
      };
      const directive = snapshot.robot;
      const robotA = robotPlacement(from, input.from, input.viewport);
      const robotB = robotPlacement(to, input.to, input.viewport);
      return {
        id, progress: t, ...ownership, camera,
        robot: { directive, ...blendRobotPlacement(robotA, robotB, camera.blend) },
        particles: null, lighting: null,
        portal: { anchor: [0, 0, 0], radius: 0, open: 0, previewOn: false },
        wash: ramp(t, beats.washIn) * (1 - ramp(t, beats.washOut)), dissolve: 0,
        robotPose: { clipA: directive, clipB: null, weight: 0, pose: 'rest', poseWeight: 0 },
        background: (snapshot.visual.background as [number, number, number] | undefined) ?? null,
        fog: null, exposure: 1,
        lights: { aWeight: ownership.owner === from ? 1 : 0, bWeight: ownership.owner === to ? 1 : 0 },
        ui: { aProgress: 1, bProgress: 0, jumpProgress: t },
      };
    },
    apply(snapshot, ctx) { ctx.intents = snapshot; },
  };
}
export const transitions = Object.fromEntries(SCENE_IDS.slice(0, -1).map((from, i) => [`${from}->${SCENE_IDS[i + 1]}`, boundary(from, SCENE_IDS[i + 1])])) as Record<TransitionId, TransitionDef>;

export function transitionAt(scene: SceneId, local: number, reduced = false) {
  if (reduced) return null;
  const p = clamp(local);
  const definition = Object.values(transitions).find(def => (scene === def.from && p >= def.window[0]) || (scene === def.to && p < def.window[1]));
  if (!definition) return null;
  const a = SCROLL_MAP[SCENE_IDS.indexOf(definition.from)];
  const b = SCROLL_MAP[SCENE_IDS.indexOf(definition.to)];
  const offset = scene === definition.from ? p * a.budget - (a.budget - a.head) : a.head + p * b.budget;
  return { definition, progress: clamp(Math.round(offset / (a.head + b.tail) * 1e12) / 1e12), fromLocal: 1, toLocal: 0 };
}
export function sampleBoundary(scene: SceneId, input: SampleInput & { narrativeLocal: number }, snapshot: SceneSnapshot) {
  const active = transitionAt(scene, input.narrativeLocal, input.profile.motion === 'reduced');
  const camera = { from: snapshot.camera, to: snapshot.camera, blend: 1 };
  if (!active) return { camera, transition: null, snapshots: { [scene]: snapshot } as Partial<Record<SceneId, SceneSnapshot>> };
  const { definition, progress } = active;
  const from = scenes[definition.from].sample({ ...input, local: 1 });
  const to = scenes[definition.to].sample({ ...input, local: 0 });
  const transition: TransitionSnapshot = definition.sample(progress, { ...input, active: scene, from, to, camera });
  return { camera: transition.camera, transition, snapshots: { [definition.from]: from, [definition.to]: to } as Partial<Record<SceneId, SceneSnapshot>> };
}
export function mountedScenes(scene: SceneId, local: number, reduced = false): SceneId[] {
  const active = transitionAt(scene, local, reduced);
  return active ? [active.definition.from, active.definition.to] : [scene];
}
export function residentScenes(scene: SceneId, local: number, reduced = false, direction = 1): SceneId[] {
  const mounted = mountedScenes(scene, local, reduced);
  if (reduced || mounted.length > 1) return mounted;
  const index = SCENE_IDS.indexOf(scene);
  const b = bodyProgress(scene, local);
  if (direction >= 0 && b >= .5 && index < 6) return [scene, SCENE_IDS[index + 1]];
  if (direction < 0 && index > 0) {
    const row = SCROLL_MAP[index];
    const previous = SCROLL_MAP[index - 1];
    if (row.start + local * row.budget - row.hero <= 100) return [scene, previous.id];
  }
  return mounted;
}
