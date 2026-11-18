import { Euler, Quaternion, Vector3 } from 'three';
import type { SampleInput, SceneId, SceneSnapshot } from '../contracts';
import { SCENE_HEROES } from '../scenes/manifests';

export function robotPlacement(scene: SceneId, snapshot: SceneSnapshot, viewport: SampleInput['viewport']) {
  void viewport;
  const hero = SCENE_HEROES[scene].robot;
  const visual = snapshot.visual;
  const position = (visual.robotPosition as [number, number, number] | undefined) ?? [...hero.rootPosition];
  const quaternion = (visual.robotQuaternion as [number, number, number, number] | undefined)
    ?? (typeof visual.robotYaw === 'number'
      ? (new Quaternion().setFromEuler(new Euler(0, visual.robotYaw, 0)).toArray() as [number, number, number, number])
      : [...hero.quaternion]);
  const scale = typeof visual.robotScale === 'number' ? visual.robotScale : hero.scale;
  return { position, quaternion, scale };
}

export function blendRobotPlacement(from: ReturnType<typeof robotPlacement>, to: ReturnType<typeof robotPlacement>, t: number) {
  return {
    position: new Vector3(...from.position).lerp(new Vector3(...to.position), t).toArray() as [number, number, number],
    quaternion: new Quaternion().fromArray(from.quaternion).slerp(new Quaternion().fromArray(to.quaternion), t).toArray() as [number, number, number, number],
  };
}
