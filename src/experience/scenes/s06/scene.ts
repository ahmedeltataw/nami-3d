import { clamp } from '../../controller';
import type { Ctx, SceneDef } from '../../contracts';
import { getParticleTargetMode, getS06Phase, getValueIndex, getValueWindow, VALUE_WINDOW, VALUES_COUNT } from './math';

export type S06Visual = {
  phase: 'ambient' | 'values' | 'converge' | 'reveal';
  valueIndex: number;
  valueProgress: number;
  convergeProgress: number;
  logoOpacity: number;
  particleOpacity: number;
  particleMode: string;
  robotState: 'idle' | 'guiding' | 'interacting';
};

export const S06_ENTRY_CAMERA: [number, number, number] = [0, 0, 4.75];
export const S06_EXIT_CAMERA: [number, number, number] = [0, 0, 4.4];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export const scene: SceneDef = {
  id: 's06',
  assets: ['poster:s06', 'logo.3d'],
  poster: '/posters/s06.svg',

  sample(input) {
    const local = clamp(input.local);
    const reduced = input.profile.motion === 'reduced';

    if (reduced) {
      return {
        camera: {
          position: [...S06_EXIT_CAMERA],
          quaternion: [0, 0, 0, 1],
          fov: 50,
          near: 0.1,
          far: 100,
        },
        robot: { kind: 'pose', name: 'rest' },
        visual: {
          phase: 'reveal',
          valueIndex: VALUES_COUNT - 1,
          valueProgress: 1,
          convergeProgress: 1,
          logoOpacity: 1,
          particleOpacity: 0,
          particleMode: 'logo',
          robotState: 'idle',
        } satisfies S06Visual,
      };
    }

    const phase = getS06Phase(local);
    const particleMode = getParticleTargetMode(local);
    const valueIndex = getValueIndex(local);

    let valueProgress = 0;
    let convergeProgress = 0;
    let logoOpacity = 0;
    let particleOpacity = 1;
    let robotState: S06Visual['robotState'] = 'idle';

    // Camera smoothly travels from S05 exit [0, 0, 4.75] to S06 exit [0, 0, 4.4]
    const camZ = lerp(S06_ENTRY_CAMERA[2], S06_EXIT_CAMERA[2], local);
    const camera = {
      position: [0, 0, camZ] as [number, number, number],
      quaternion: [0, 0, 0, 1] as [number, number, number, number],
      fov: 50,
      near: 0.1,
      far: 100,
    };

    let robotDirective: import('../../contracts').RobotDirective;

    if (phase === 'ambient') {
      particleOpacity = clamp(local / 0.05);
      robotDirective = { kind: 'clip', name: 'Idle', timeSeconds: local * 10, weight: 1 };
      robotState = 'idle';
    } else if (phase === 'values') {
      const window = getValueWindow(valueIndex);
      valueProgress = clamp((local - window.start) / VALUE_WINDOW);
      convergeProgress = valueProgress;
      particleOpacity = 1;

      // Alternating gestures: even index = Wave (Present), odd index = Point
      if (valueIndex % 2 === 0) {
        robotDirective = { kind: 'clip', name: 'Wave', timeSeconds: valueProgress * 2, weight: 1 };
      } else {
        robotDirective = { kind: 'point', target: 'S06_ValueTarget' };
      }
      robotState = 'guiding';
    } else if (phase === 'converge') {
      valueProgress = 1;
      convergeProgress = clamp((local - 0.70) / 0.20);
      particleOpacity = 1;
      robotDirective = { kind: 'clip', name: 'Idle', timeSeconds: local * 10, weight: 1 };
      robotState = 'idle';
    } else {
      // reveal: crossfade 0.90..1.00
      valueProgress = 1;
      convergeProgress = 1;
      const revealProgress = local >= 1.0 ? 1 : clamp((local - 0.90) / 0.10);
      logoOpacity = revealProgress;
      particleOpacity = local >= 1.0 ? 0 : 1 - revealProgress;
      // At local = 1.0, robot is center rest (matches S07 entry)
      robotDirective = local >= 1.0 ? { kind: 'rest' } : { kind: 'clip', name: 'Idle', timeSeconds: local * 10, weight: 1 - revealProgress };
      robotState = 'idle';
    }

    return {
      camera,
      robot: robotDirective,
      visual: {
        phase,
        valueIndex,
        valueProgress,
        convergeProgress,
        logoOpacity,
        particleOpacity,
        particleMode,
        robotState,
      } satisfies S06Visual,
    };
  },

  apply(snapshot, ctx: Ctx) {
    const visual = snapshot.visual as unknown as S06Visual;
    const logoGroup = ctx.root.getObjectByName('S06_Logo');
    if (logoGroup) {
      const opacity = typeof visual.logoOpacity === 'number' ? visual.logoOpacity : 0;
      logoGroup.visible = opacity > 0.001;
      logoGroup.traverse(node => {
        if ('isMesh' in node && node.isMesh && 'material' in node && node.material) {
          const mat = node.material as import('three').Material;
          mat.transparent = true;
          mat.opacity = opacity;
        }
      });
    }

    {
      const targetAnchor = ctx.root.getObjectByName('S06_ValueTarget');
      if (targetAnchor) {
        targetAnchor.position.y = 0.25 + Math.sin(ctx.ambient * 0.8) * 0.03 * (ctx.reducedMotion ? 0 : ctx.ambientWeight ?? 1);
      }
    }
  },
};
