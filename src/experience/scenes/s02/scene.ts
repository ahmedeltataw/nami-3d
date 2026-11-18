import { clamp } from '../../controller';
import type { CameraPose, Ctx, RobotDirective, SceneDef, SceneSnapshot } from '../../contracts';
import { ringAngles } from '../../shared/portal/motion';
import { SCENE_HEROES, s02PortalData } from '../manifests';

export const ramp = (p: number, from: number, to: number) => clamp((p - from) / (to - from));
const smooth = (p: number) => p * p * (3 - 2 * p);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const HERO = SCENE_HEROES.s02;

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
  robotScale: number;
};
export type S02Context = Ctx & { update?: (snapshot: SceneSnapshot) => void };

function clip(name: 'ChargeEnergy' | 'OpenPortal' | 'Fly', timeSeconds: number): RobotDirective {
  return { kind: 'clip', name, timeSeconds, weight: 1 } as RobotDirective;
}

export const scene: SceneDef = {
  id: 's02', poster: '/posters/s02.svg', assets: ['poster:s02', 's02.kit'],
  sample(input) {
    const p = clamp(input.local);
    const reduced = input.profile.motion === 'reduced';
    const push = reduced ? 0 : smooth(ramp(p, .75, .92));
    const reveal = 0;
    const heroFov = HERO.camera.fov;
    const camera: CameraPose = {
      position: [HERO.camera.position[0], HERO.camera.position[1], mix(HERO.camera.position[2], -5.8, push)],
      quaternion: [...HERO.camera.quaternion],
      fov: reduced ? heroFov : p < .835 ? mix(heroFov, 66, ramp(p, .75, .835)) : mix(66, 64, ramp(p, .835, .92)),
      near: HERO.camera.near,
      far: HERO.camera.far,
    };
    const assembleProgress = reduced ? Number(p >= .5) : ramp(p, .35, .5);
    const activation = reduced ? 0 : ramp(p, .5, .62);
    const ringSpeed = 1.5 * activation * activation;
    const angles = ringAngles(ringSpeed, reduced ? 0 : p * 12);
    const chargeBack = reduced ? 0 : smooth(ramp(p, 0, .2));
    const clearPortal = reduced ? 0 : smooth(ramp(p, .35, .5));
    const [rx, ry, rz] = HERO.robot.rootPosition;
    const robotX = mix(mix(rx, rx - 0.35, chargeBack), rx + 0.6, clearPortal);
    const robotZ = mix(rz + 0.4 * chargeBack, rz - 0.6, clearPortal);
    const [px, py, pz] = s02PortalData.centre_gltf;
    const robotPosition: [number, number, number] = reduced
      ? [rx, ry, rz]
      : [mix(robotX, px, push), mix(ry, py, push), mix(robotZ, pz, push)];
    const robotQuaternion: [number, number, number, number] = [...HERO.robot.quaternion];
    const robot = reduced ? { kind: 'pose' as const, name: 'rest' as const }
      : p < .35 ? clip('ChargeEnergy', ramp(p, 0, .2) * 1.4)
        : p < .75 ? clip('OpenPortal', ramp(p, .35, .5) * 1.5)
          : clip('Fly', ramp(p, .75, .92) * 1.6);
    const brightness = reduced ? (p >= .92 && p < .96 ? 1 : 0)
      : p < .96 ? smooth(ramp(p, .92, .96)) : 1 - smooth(ramp(p, .96, 1));
    const visual: S02Visual = {
      progress: p, reduced, background: backgroundColor(p),
      converge: reduced ? 1 : ramp(p, 0, .2), sphere: reduced ? 0 : ramp(p, .2, .35),
      morph: reduced ? 1 : ramp(p, .35, .5), assembleProgress, ringSpeed,
      outerAngle: angles.outer, innerAngle: angles.inner,
      openAmount: reduced ? Number(p >= .75) : ramp(p, .62, .75), surfaceTime: reduced ? 0 : p * 12,
      brightness, reveal, previewSize: input.viewport.w <= 600 ? 256 : 512,
      robotState: p < .75 ? 'performing' : 'transitioning', robotPosition, robotQuaternion,
      robotScale: HERO.robot.scale,
    };
    return { camera, robot, visual };
  },
  apply(snapshot, context) { (context as S02Context).update?.(snapshot); },
};
