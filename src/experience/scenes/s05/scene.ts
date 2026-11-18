import { Matrix4, Quaternion, Vector3 } from 'three';
import type { CameraPose, Ctx, SceneDef } from '../../contracts';
import { clamp } from '../../controller';
import { SCENE_HEROES, s05MultiverseData } from '../manifests';

export const ENTER = .05;
export const WINDOW = .15;
export const EXIT = .95;
export const projectSeekLocal = (index: number) => ENTER + WINDOW * (index + .6);
export function projectWindow(local: number) {
  const value = clamp(local);
  const scaled = Math.round((value - ENTER) / WINDOW * 1e12) / 1e12;
  const index = Math.max(0, Math.min(5, Math.floor(scaled)));
  return { index, progress: clamp(scaled - index), phase: value < ENTER ? 'enter' : value >= EXIT ? 'exit' : 'project' };
}
const smooth = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t); };
const HERO = SCENE_HEROES.s05;
const PROJECT_BUBBLE_KEYS = ['realestate', 'investment', 'ecommerce', 'ecommerce', 'transport', 'logistics'] as const;

const overviewPose: CameraPose = {
  position: [...HERO.camera.position],
  quaternion: [...HERO.camera.quaternion],
  fov: HERO.camera.fov,
  near: HERO.camera.near,
  far: HERO.camera.far,
};

function pose(position: Vector3, target: Vector3): CameraPose {
  const q = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(position, target, new Vector3(0, 1, 0)));
  return { position: position.toArray(), quaternion: q.toArray().map(value => value || 0) as [number, number, number, number], fov: HERO.camera.fov, near: HERO.camera.near, far: HERO.camera.far };
}
function bubbleCamera(index: number, aspect: number) {
  const key = PROJECT_BUBBLE_KEYS[index];
  const bubble = s05MultiverseData.bubbles[key];
  const target = new Vector3(...bubble.centre_gltf);
  const dist = aspect < .8 ? 11.5 : 8.5;
  return pose(new Vector3(target.x * .4, Math.max(1.6, target.y * .75), target.z + dist), target);
}
function blend(a: CameraPose, b: CameraPose, t: number): CameraPose {
  if (t === 0) return a;
  if (t === 1) return b;
  return { ...b, position: new Vector3(...a.position).lerp(new Vector3(...b.position), t).toArray(),
    quaternion: new Quaternion(...a.quaternion).slerp(new Quaternion(...b.quaternion), t).toArray(), fov: a.fov + (b.fov - a.fov) * t };
}
export type GalleryCtx = Ctx & { updateGallery?: (visual: Record<string, unknown>) => void };
export const scene: SceneDef = {
  id: 's05', assets: ['poster:s05', 's05.kit', 'world.rif-aljouf'], poster: '/posters/s05.svg',
  sample(input) {
    const local = clamp(input.local);
    const current = projectWindow(local);
    const reduced = input.profile.motion === 'reduced';
    const aspect = input.viewport.w / Math.max(1, input.viewport.h);
    let camera = reduced && current.phase === 'enter' ? overviewPose : bubbleCamera(current.index, aspect);
    if (!reduced && current.phase === 'enter') camera = blend(overviewPose, camera, smooth(local / ENTER));
    if (!reduced && current.index > 0 && current.progress < .2) camera = blend(bubbleCamera(current.index - 1, aspect), camera, smooth(current.progress / .2));
    const bubble = s05MultiverseData.bubbles[PROJECT_BUBBLE_KEYS[current.index]];
    const visible = current.phase !== 'enter' && (reduced || current.progress >= .22);
    return {
      camera,
      robot: reduced ? { kind: 'rest' } : {
        kind: 'clip', name: (['Point', 'Present', 'Guide'] as const)[current.index % 3], timeSeconds: current.progress * 3, weight: 1,
      },
      visual: {
        project: current.index,
        projectProgress: current.progress,
        phase: current.phase,
        robotState: 'guiding',
        robotPosition: [...HERO.robot.rootPosition],
        robotQuaternion: [...HERO.robot.quaternion],
        robotScale: HERO.robot.scale,
        robotPose: !reduced && local === 0 ? HERO.robot.jointPosesXyzw : undefined,
        robotYaw: HERO.robot.yawDeg * Math.PI / 180,
        gazeTarget: current.phase === 'enter' ? s05MultiverseData.globe.centre_gltf : bubble.centre_gltf,
        open: reduced ? 1 : smooth((current.progress - .12) / .18),
        activeTarget: visible ? current.index : null,
        worldProgress: reduced ? .5 : smooth((current.progress - .3) / .65),
        exit: 0,
      },
    };
  },
  apply(snapshot, context) { (context as GalleryCtx).updateGallery?.(snapshot.visual); },
};
