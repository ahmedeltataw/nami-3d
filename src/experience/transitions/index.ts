import type { SampleInput, SceneId, SceneSnapshot, TransitionDef, TransitionId, TransitionSnapshot } from '../contracts';
import { clamp, SCENE_IDS, SCROLL_BUDGETS } from '../controller';
import { scenes } from '../scenes';

function boundary(from: SceneId, to: SceneId): TransitionDef {
  return {
    from, to, window: [.9, .1],
    sample(t, input) {
      const source = input.active === from;
      const snapshot = source ? input.from : input.to;
      return {
        id: `${from}->${to}` as TransitionId, progress: clamp(t),
        fromVisibility: Number(source), toVisibility: Number(!source),
        camera: input.camera,
        robot: {
          directive: snapshot.robot,
          position: (snapshot.visual.robotPosition as [number, number, number] | undefined) ?? null,
          quaternion: (snapshot.visual.robotQuaternion as [number, number, number, number] | undefined) ?? null,
        },
        particles: null, lighting: null, ui: null,
      };
    },
    apply(snapshot, ctx) { ctx.intents = snapshot; },
  };
}

export const transitions: Record<TransitionId, TransitionDef> = Object.fromEntries(
  SCENE_IDS.slice(0, -1).map((from, i) => [`${from}->${SCENE_IDS[i + 1]}`, boundary(from, SCENE_IDS[i + 1])]),
) as Record<TransitionId, TransitionDef>;

export function transitionAt(scene: SceneId, local: number, reduced = false) {
  if (reduced) return null;
  const p = clamp(local);
  const definition = Object.values(transitions).find(def => (scene === def.from && p >= def.window[0]) || (scene === def.to && p <= def.window[1]));
  if (!definition) return null;
  const { from, to } = definition;
  const fromIndex = SCENE_IDS.indexOf(from);
  const [start, end] = definition.window;
  const sourceSpan = (1 - start) * SCROLL_BUDGETS[fromIndex];
  const destinationSpan = end * SCROLL_BUDGETS[fromIndex + 1];
  const offset = scene === from ? (p - start) * SCROLL_BUDGETS[fromIndex] : sourceSpan + p * SCROLL_BUDGETS[fromIndex + 1];
  return { definition, progress: clamp(offset / (sourceSpan + destinationSpan)), fromLocal: scene === from ? p : 1, toLocal: scene === to ? p : 0 };
}

export function sampleBoundary(scene: SceneId, input: SampleInput, snapshot: SceneSnapshot) {
  const index = SCENE_IDS.indexOf(scene);
  const previous = index > 0 && scene !== 's03' && scene !== 's05'
    ? scenes[SCENE_IDS[index - 1]].sample({ ...input, local: 1 }).camera : snapshot.camera;
  const camera = { from: previous, to: snapshot.camera, blend: input.profile.motion === 'reduced' ? 1 : clamp(input.local / .08) };
  const active = transitionAt(scene, input.local, input.profile.motion === 'reduced');
  if (!active) return { camera, transition: null, snapshots: { [scene]: snapshot } as Partial<Record<SceneId, SceneSnapshot>> };
  const { definition, progress, fromLocal, toLocal } = active;
  const from = scene === definition.from ? snapshot : scenes[definition.from].sample({ ...input, local: fromLocal });
  const to = scene === definition.to ? snapshot : scenes[definition.to].sample({ ...input, local: toLocal });
  const transition: TransitionSnapshot = definition.sample(progress, { ...input, active: scene, from, to, camera });
  return { camera: transition.camera, transition, snapshots: { [definition.from]: from, [definition.to]: to } as Partial<Record<SceneId, SceneSnapshot>> };
}

export function mountedScenes(scene: SceneId, local: number, reduced = false): SceneId[] {
  const active = transitionAt(scene, local, reduced);
  return active ? [active.definition.from, active.definition.to] : [scene];
}

// Asset-only lead-in uses existing scroll space; it never changes section heights.
export function residentScenes(scene: SceneId, local: number, reduced = false): SceneId[] {
  const mounted = mountedScenes(scene, local, reduced);
  if (reduced || mounted.length > 1) return mounted;
  const index = SCENE_IDS.indexOf(scene);
  if (local >= .8 && index < 6) return [scene, SCENE_IDS[index + 1]];
  if (local <= .2 && index > 0) return [scene, SCENE_IDS[index - 1]];
  return mounted;
}
