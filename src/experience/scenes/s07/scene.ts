import { ambientAngle } from '../../ambient';
import { clamp } from '../../controller';
import type { Ctx, SceneDef } from '../../contracts';

export const S07_ENTRY_CAMERA: [number, number, number] = [0, 0, 4.4];
export const S07_EXIT_CAMERA: [number, number, number] = [0, 0, 4.4];

export type S07Visual = {
  coreAppearance: number;
  coreSpin: number;
  optionsReady: boolean;
  robotState: 'interacting';
};

export const scene: SceneDef = {
  id: 's07',
  assets: ['poster:s07', 'tech.cubes', 'display.platform'],
  poster: '/posters/s07.svg',

  sample(input) {
    const local = clamp(input.local);
    const reduced = input.profile.motion === 'reduced';

    if (reduced) {
      return {
        camera: {
          position: [...S07_ENTRY_CAMERA],
          quaternion: [0, 0, 0, 1],
          fov: 50,
          near: 0.1,
          far: 100,
        },
        robot: { kind: 'pose', name: 'rest' },
        visual: {
          coreAppearance: 1,
          coreSpin: 0,
          optionsReady: true,
          robotState: 'interacting',
        } satisfies S07Visual,
      };
    }

    const camera = {
      position: [...S07_ENTRY_CAMERA] as [number, number, number],
      quaternion: [0, 0, 0, 1] as [number, number, number, number],
      fov: 50,
      near: 0.1,
      far: 100,
    };

    let coreAppearance = 1;
    const coreSpin = local * Math.PI * 4;
    let robotDirective: import('../../contracts').RobotDirective;

    if (local <= 0) {
      coreAppearance = 0;
      robotDirective = { kind: 'rest' };
    } else if (local < 0.30) {
      coreAppearance = clamp(local / 0.30);
      // Robot extends hands (waving/presenting hands forward)
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
