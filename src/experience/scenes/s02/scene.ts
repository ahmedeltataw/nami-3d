import { Quaternion, Vector3 } from 'three';
import { clamp } from '../../controller';
import type { CameraPose, Ctx, RobotDirective, SceneDef, SceneSnapshot } from '../../contracts';
import { scene as lab } from '../s03/scene';
import { ringAngles } from '../../shared/portal/motion';

export const ramp = (p: number, from: number, to: number) => clamp((p - from) / (to - from));
const smooth = (p: number) => p * p * (3 - 2 * p);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export function backgroundColor(progress: number): [number, number, number] {
  const t = ramp(clamp(progress), 0, .4);
  return [mix(255, 27, t) / 255, mix(255, 29, t) / 255, mix(255, 32, t) / 255];
}

export type S02Visual = {
  progress: number; reduced: boolean; background: [number, number, number];
  converge: number; sphere: number; morph: number; assembleProgress: number;
  ringSpeed: number; outerAngle: number; innerAngle: number; openAmount: number;
  surfaceTime: number; brightness: number; reveal: number; previewSize: number;
  robotState: string; robotPosition: [number, number, number]; robotQuaternion: [number, number, number, number];
};
export type S02Context = Ctx & { update?: (snapshot: SceneSnapshot) => void };

// RobotComposer supports these imported clips; the public union predates batch B.
function clip(name: 'ChargeEnergy' | 'OpenPortal' | 'Fly', timeSeconds: number): RobotDirective {
  return { kind: 'clip', name, timeSeconds, weight: 1 } as RobotDirective;
}

export const scene: SceneDef = {
  id: 's02', poster: '/posters/s02.svg', assets: ['poster:s02', 'portal.gate', 'lab.shell'],
  sample(input) {
    const p = clamp(input.local);
    const reduced = input.profile.motion === 'reduced';
    const entry = lab.sample({ ...input, local: 0 });
    const push = reduced ? 0 : smooth(ramp(p, .75, .92));
    const reveal = reduced ? (p < .92 ? 0 : p < .96 ? .5 : 1) : smooth(ramp(p, .92, 1));
    const camera: CameraPose = { position: [0, 0, mix(2.6, -3.2, push)], quaternion: [0, 0, 0, 1],
      fov: p < .835 ? mix(35, 42, ramp(p, .75, .835)) : mix(42, 40, ramp(p, .835, .92)), near: .1, far: 100 };
    if (reduced) camera.fov = 35;
    if (reveal > 0) {
      for (let i = 0; i < 3; i++) camera.position[i] = mix(camera.position[i], entry.camera.position[i], reveal);
      camera.quaternion = new Quaternion().fromArray(camera.quaternion).slerp(new Quaternion().fromArray(entry.camera.quaternion), reveal).toArray();
      camera.fov = mix(camera.fov, entry.camera.fov, reveal);
    }
    if (p === 1 || (reduced && reveal === 1)) Object.assign(camera, entry.camera);
    const assembleProgress = reduced ? Number(p >= .5) : ramp(p, .35, .5);
    const activation = reduced ? 0 : ramp(p, .5, .62);
    const ringSpeed = 1.5 * activation * activation;
    const angles = ringAngles(ringSpeed, reduced ? 0 : p * 12);
    const scale = .52 * Math.min(1, (input.viewport.w / Math.max(1, input.viewport.h)) / .85);
    // Match S03's current placement, including its final X/Y overrides.
    const labRobot = new Vector3(-1.2, -.8, -3.3).applyQuaternion(new Quaternion().fromArray(entry.camera.quaternion)).add(new Vector3(...entry.camera.position));
    const chargeBack = reduced ? 1 : smooth(ramp(p, 0, .2));
    const clearPortal = reduced ? Number(p >= .5) : smooth(ramp(p, .35, .5));
    const robotX = mix(mix(-.55, -.2, chargeBack), -1.15, clearPortal);
    const robotZ = mix(-.65 * chargeBack, -1.3, clearPortal);
    const robotPosition: [number, number, number] = [mix(robotX * (1 - push), 0, reveal),
      mix(-1.69 * scale + .25 * push, -1.69 * scale, reveal), mix(mix(robotZ, -3.6, push), labRobot.z, reveal)];
    const robotQuaternion = new Quaternion().slerp(new Quaternion().fromArray(entry.camera.quaternion), reveal).toArray();
    const robot = p === 1 ? entry.robot : reduced ? { kind: 'pose' as const, name: 'rest' as const }
      : p < .35 ? clip('ChargeEnergy', ramp(p, 0, .2) * 1.4)
        : p < .75 ? clip('OpenPortal', ramp(p, .35, .5) * 1.5)
          : clip('Fly', ramp(p, .75, .92) * 1.6);
    const brightness = reduced ? (p >= .92 && p < .96 ? 1 : 0)
      : p < .96 ? smooth(ramp(p, .92, .96)) : 1 - smooth(ramp(p, .96, 1));
    const visual: S02Visual = {
      progress: p, reduced, background: backgroundColor(reduced ? (p >= .4 ? .4 : 0) : p),
      converge: reduced ? 1 : ramp(p, 0, .2), sphere: reduced ? 0 : ramp(p, .2, .35),
      morph: reduced ? 1 : ramp(p, .35, .5), assembleProgress, ringSpeed,
      outerAngle: angles.outer, innerAngle: angles.inner,
      openAmount: reduced ? Number(p >= .75) : ramp(p, .62, .75), surfaceTime: reduced ? 0 : p * 12,
      brightness, reveal, previewSize: input.viewport.w <= 600 ? 256 : 512,
      robotState: p === 1 ? 'guiding' : p < .75 ? 'performing' : 'transitioning', robotPosition, robotQuaternion,
    };
    return { camera, robot, visual };
  },
  apply(snapshot, context) { (context as S02Context).update?.(snapshot); },
};
