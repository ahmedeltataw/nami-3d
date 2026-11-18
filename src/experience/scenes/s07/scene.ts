import { ambientAngle } from '../../ambient';
import { clamp } from '../../controller';
import type { Ctx, SceneDef } from '../../contracts';
import { SCENE_HEROES } from '../manifests';

const HERO = SCENE_HEROES.s07;
export const S07_ENTRY_CAMERA: [number, number, number] = [...HERO.camera.position];
export const S07_EXIT_CAMERA: [number, number, number] = [...HERO.camera.position];

export type S07Visual = {
  coreAppearance: number;
  coreSpin: number;
  optionsReady: boolean;
  robotState: 'interacting';
  robotPosition: [number, number, number];
  robotQuaternion: [number, number, number, number];
  robotScale: number;
};

export const scene: SceneDef = {
  id: 's07',
  assets: ['poster:s07', 's07.kit'],
  poster: '/posters/s07.svg',

  sample(input) {
    const local = clamp(input.local);
    const reduced = input.profile.motion === 'reduced';
    const robotVisual = {
      robotPosition: [...HERO.robot.rootPosition] as [number, number, number],
      robotQuaternion: [...HERO.robot.quaternion] as [number, number, number, number],
      robotScale: HERO.robot.scale,
    };

    const camera = {
      position: [...HERO.camera.position] as [number, number, number],
      quaternion: [...HERO.camera.quaternion] as [number, number, number, number],
      fov: HERO.camera.fov,
      near: HERO.camera.near,
      far: HERO.camera.far,
    };

    if (reduced) {
      return {
        camera,
        robot: { kind: 'pose', name: 'rest' },
        visual: {
          coreAppearance: 1,
          coreSpin: 0,
          optionsReady: true,
          robotState: 'interacting',
          ...robotVisual,
        } satisfies S07Visual,
      };
    }

    let coreAppearance = 1;
    const coreSpin = local * Math.PI * 4;
    let robotDirective: import('../../contracts').RobotDirective;

    if (local <= 0) {
      coreAppearance = 0;
      robotDirective = { kind: 'rest' };
    } else if (local < 0.30) {
      coreAppearance = clamp(local / 0.30);
      robotDirective = {
        kind: 'clip',
        name: 'Wave',
        timeSeconds: local * 3,
        weight: clamp(local / 0.15),
      };
    } else {
      coreAppearance = 1;
      robotDirective = { kind: 'rest' };
    }

    return {
      camera,
      robot: robotDirective,
      visual: {
        coreAppearance,
        coreSpin,
        optionsReady: local >= 0.30,
        robotState: 'interacting',
        ...robotVisual,
      } satisfies S07Visual,
    };
  },

  apply(snapshot, ctx: Ctx) {
    const visual = snapshot.visual as unknown as S07Visual;
    const coreGroup = ctx.root.getObjectByName('S07_EnergyCore');
    if (coreGroup) {
      if (ctx.reducedMotion) { coreGroup.rotation.set(0, 0, 0); } else {
        coreGroup.rotation.y = visual.coreSpin + ambientAngle(ctx.ambient, .5, ctx.ambientWeight ?? 1);
        coreGroup.rotation.x = Math.sin(ctx.ambient * 0.3) * 0.2 * (ctx.ambientWeight ?? 1);
      }
    }
  },
};
