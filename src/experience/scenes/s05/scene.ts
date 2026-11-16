import { Matrix4, Quaternion, Vector3 } from 'three';
import type { CameraPose, Ctx, SceneDef } from '../../contracts';
import { clamp } from '../../controller';
import { scene as nextScene } from '../s06/scene';
import gallery from '../../../../assets-model/export/gallery_shell.manifest.json';

export const ENTER = .05;
export const WINDOW = .15;
export const EXIT = .95;
export function projectWindow(local: number) {
  const value = clamp(local);
  const scaled = Math.round((value - ENTER) / WINDOW * 1e12) / 1e12;
  const index = Math.max(0, Math.min(5, Math.floor(scaled)));
  return { index, progress: clamp(scaled - index), phase: value < ENTER ? 'enter' : value >= EXIT ? 'exit' : 'project' };
}
const smooth = (t: number) => { t = clamp(t); return t * t * (3 - 2 * t); };
function pose(position: Vector3, target: Vector3): CameraPose {
  const q = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(position, target, new Vector3(0, 1, 0)));
  return { position: position.toArray(), quaternion: q.toArray(), fov: 48, near: .1, far: 100 };
}
function gateCamera(index: number, aspect: number) {
  const gate = gallery.gates[index];
  const target = new Vector3(...gate.gate_position_gltf);
  const facing = new Vector3(...gate.gate_facing_gltf);
  return pose(target.clone().addScaledVector(facing, aspect < .8 ? 10 : 7.5).add(new Vector3(0, .4, 0)), target);
}
function blend(a: CameraPose, b: CameraPose, t: number): CameraPose {
  return { ...b, position: new Vector3(...a.position).lerp(new Vector3(...b.position), t).toArray(),
    quaternion: new Quaternion(...a.quaternion).slerp(new Quaternion(...b.quaternion), t).toArray(), fov: a.fov + (b.fov - a.fov) * t };
}
export type GalleryCtx = Ctx & { updateGallery?: (visual: Record<string, unknown>) => void };
export const scene: SceneDef = {
  id: 's05', assets: ['poster:s05', 'gallery.shell', 'gallery.portal', 'world.rif-aljouf'], poster: '/posters/s05.svg',
  sample(input) {
    const local = clamp(input.local);
    const current = projectWindow(local);
    const reduced = input.profile.motion === 'reduced';
    const aspect = input.viewport.w / Math.max(1, input.viewport.h);
    const overview = pose(new Vector3(0, 5, 7), new Vector3(0, 2, -7));
    // Reduced motion selects a still pose per project; there is no camera tween.
    let camera = gateCamera(current.index, aspect);
    if (!reduced && current.phase === 'enter') camera = blend(overview, camera, smooth(local / ENTER));
    if (!reduced && current.index > 0 && current.progress < .2) camera = blend(gateCamera(current.index - 1, aspect), camera, smooth(current.progress / .2));
    const exit = current.phase === 'exit' ? smooth((local - EXIT) / .05) : 0;
    const next = nextScene.sample({ ...input, local: 0 });
    if (exit > 0 && !reduced) camera = blend(camera, next.camera, exit);
    if (local === 1) camera = next.camera;
    const spot = new Vector3(...gallery.gates[current.index].robot_spot_gltf);
    const scale = .52 * Math.min(1, aspect / .85);
    const center = new Vector3(0, -1.69 * scale, 0);
    // The exported robot is centred vertically; its feet sit on the authored pad.
    spot.y += 1.69 * scale;
    spot.lerp(center, exit);
    const visible = current.phase === 'project' && (reduced || current.progress >= .22);
    return { camera, robot: exit === 1 || reduced ? { kind: 'rest' } : {
      kind: 'clip', name: (['Point', 'Present', 'Guide'] as const)[current.index % 3], timeSeconds: current.progress * 3, weight: 1 - exit,
    }, visual: { project: current.index, projectProgress: current.progress, phase: current.phase, robotState: exit === 1 ? 'idle' : 'guiding',
      robotPosition: spot.toArray(), robotYaw: Math.atan2(gallery.gates[current.index].gate_position_gltf[0] - gallery.gates[current.index].robot_spot_gltf[0], gallery.gates[current.index].gate_position_gltf[2] - gallery.gates[current.index].robot_spot_gltf[2]) * (1 - exit),
      gazeTarget: exit ? null : gallery.gates[current.index].gate_position_gltf,
      open: reduced ? 1 : smooth((current.progress - .12) / .18), activeTarget: visible ? current.index : null,
      worldProgress: reduced ? .5 : smooth((current.progress - .3) / .65), exit,
    } };
  },
  apply(snapshot, context) { (context as GalleryCtx).updateGallery?.(snapshot.visual); },
};
