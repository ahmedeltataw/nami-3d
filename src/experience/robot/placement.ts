import { Euler, Quaternion, Vector3 } from 'three';
import type { SampleInput, SceneId, SceneSnapshot } from '../contracts';

export function robotPlacement(scene: SceneId, snapshot: SceneSnapshot, viewport: SampleInput['viewport']) {
  const aspect = viewport.w / Math.max(1, viewport.h);
  const scale = .52 * Math.min(1, aspect / .85);
  const visual = snapshot.visual;
  const position = visual.robotPosition as [number, number, number] | undefined ?? [
    scene === 's01' ? Number(visual.robotX ?? 0) : scene === 's04' ? -1.05 : 0,
    -1.69 * scale - (scene === 's01' && viewport.w <= 600 && aspect < .8 ? .5 : 0), 0,
  ];
  const quaternion = visual.robotQuaternion as [number, number, number, number] | undefined
    ?? new Quaternion().setFromEuler(new Euler(0, Number(visual.robotYaw ?? 0), 0)).toArray();
  return { position, quaternion };
}

export function blendRobotPlacement(from: ReturnType<typeof robotPlacement>, to: ReturnType<typeof robotPlacement>, t: number) {
  return { position: new Vector3(...from.position).lerp(new Vector3(...to.position), t).toArray(), quaternion: new Quaternion().fromArray(from.quaternion).slerp(new Quaternion().fromArray(to.quaternion), t).toArray() };
}
