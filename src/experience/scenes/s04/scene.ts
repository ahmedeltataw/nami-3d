import { clamp } from '../../controller';
import type { Ctx, SceneDef } from '../../contracts';
import type { Object3D, Vector3 } from 'three';
import { SCENE_HEROES } from '../manifests';

export const assemblyOrder = ['Frame', 'BackPlate', 'Buttons', 'Board', 'Battery', 'Speaker', 'CameraModule', 'Glass', 'Display'] as const;
export const displayStages = ['layout', 'nav', 'type', 'components', 'images', 'colors', 'final'] as const;
export type PhonePart = { node: Object3D; assembled: Vector3; offset: Vector3; order: number };
export type PhoneCtx = Ctx & { model?: Object3D; parts: PhonePart[]; drawDisplay: (stage: number, blend: number) => void };
const smooth = (n: number) => { const t = clamp(n); return t * t * (3 - 2 * t); };
const HERO = SCENE_HEROES.s04;

export function assemblyProgress(local: number, order: number) {
  if (order === 0) return 1;
  return smooth(((local - .25) / .35 * 8 - (order - 1)) / 1);
}
export function displayProgress(local: number) {
  const value = clamp((local - .6) / .3) * 6;
  const stage = Math.min(6, Math.floor(value));
  return { stage, blend: stage === 6 ? 0 : smooth(value - stage) };
}
export const scene: SceneDef = {
  id: 's04', poster: '/posters/s04.svg', assets: ['poster:s04', 's04.kit'],
  sample(input) {
    const local = clamp(input.local);
    const reduced = input.profile.motion === 'reduced';
    const progress = reduced ? 1 : local;
    const display = displayProgress(progress);
    const close = reduced ? 0 : smooth((local - .9) / .1);
    const current = Math.min(8, Math.max(0, Math.floor(clamp((local - .25) / .35) * 8) + 1));
    return {
      camera: {
        position: [HERO.camera.position[0], HERO.camera.position[1], HERO.camera.position[2] - .7 * close],
        quaternion: [...HERO.camera.quaternion],
        fov: HERO.camera.fov,
        near: HERO.camera.near,
        far: HERO.camera.far,
      },
      robot: reduced ? { kind: 'pose', name: 'rest' } : local >= .9 ? { kind: 'clip', name: 'Present', timeSeconds: 1.6, weight: 1 } : local < .1 ? { kind: 'clip', name: 'Point', timeSeconds: 1, weight: 1 } : { kind: 'point', target: local < .25 || local >= .6 ? 'PhoneTarget' : assemblyOrder[current] },
      visual: {
        robotState: 'guiding',
        robotPosition: [...HERO.robot.rootPosition],
        robotQuaternion: [...HERO.robot.quaternion],
        robotScale: HERO.robot.scale,
        local: progress,
        visible: true,
        displayStage: display.stage,
        displayBlend: display.blend,
        close,
      },
    };
  },
  apply(snapshot, context) {
    const phone = context as PhoneCtx;
    const local = Number(snapshot.visual.local);
    if (phone.model) phone.model.visible = Boolean(snapshot.visual.visible);
    for (const part of phone.parts ?? []) {
      const progress = assemblyProgress(local, part.order);
      part.node.position.copy(part.assembled).addScaledVector(part.offset, 1 - progress);
      if (!context.reducedMotion && local >= .1 && local < .25 && part.order > 0) part.node.position.y += Math.sin(context.ambient * 1.2 + part.order) * .025 * (context.ambientWeight ?? 1);
    }
    phone.drawDisplay?.(Number(snapshot.visual.displayStage), Number(snapshot.visual.displayBlend));
  },
};
