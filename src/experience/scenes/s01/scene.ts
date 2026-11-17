import { clamp } from '../../controller';
import { INTRO_END, sampleIntro } from '../../robot/intro';
import type { SceneDef } from '../../contracts';
import { headlineReveal } from './headline';

const ramp = (value: number, start: number, end: number) => clamp((value - start) / (end - start));

export const scene: SceneDef = {
  id: 's01', assets: ['poster:s01'], poster: '/posters/s01.svg',
  sample(input) {
    const local = clamp(input.local);
    const reduced = input.profile.motion === 'reduced';
    const intro = !reduced && local === 0 && input.introSeconds !== undefined && input.introSeconds < INTRO_END;
    const seconds = intro ? input.introSeconds! : INTRO_END;
    const dolly = reduced ? (local >= 1 ? 1 : 0) : ramp(local, 0.55, 1);
    const wake = ramp(seconds, 0, 1.2);
    const drawing = intro ? ramp(seconds, 3.4, INTRO_END) : local === 0 ? 1 : ramp(local, 0, .35);
    return {
      camera: { position: [0, 0, 4.2 - 1.6 * dolly], quaternion: [0, 0, 0, 1], fov: 35, near: 0.1, far: 100 },
      robot: reduced ? { kind: 'pose', name: 'rest' }
        : intro ? sampleIntro(seconds, { kind: 'clip', name: 'Sleep', timeSeconds: 0, weight: 1 })
          : local > 0 && local < .35 ? { kind: 'clip', name: 'Draw', timeSeconds: drawing * 1.2, weight: 1 }
          : { kind: 'clip', name: dolly > 0 ? 'ChargeEnergy' : 'Idle', timeSeconds: 0, weight: 1 },
      visual: {
        robotState: 'interacting', robotX: -0.55 * dolly,
        eyeOpen: wake * (1 - 0.25 * dolly), headPitch: intro && seconds < 1.2 ? (1 - wake) * -8 * Math.PI / 180 : undefined,
        focus: dolly, headlineExit: dolly,
        subtitleEmphasis: ramp(local, 0.35, 0.55),
        scrollHint: (intro ? 0 : 1) * (1 - dolly),
        discover: intro && seconds >= 1 && seconds < 1.8,
        line: reduced ? 0 : drawing,
        headlineReveal: reduced ? 100 : headlineReveal(drawing),
      },
    };
  },
  apply(_snapshot, ctx) {
    ctx.root.rotation.y = ctx.reducedMotion ? 0 : Math.sin(ctx.ambient * 0.06) * 0.12 * (ctx.ambientWeight ?? 1);
    ctx.root.position.y = ctx.reducedMotion ? 0 : Math.sin(ctx.ambient * 0.12) * 0.025 * (ctx.ambientWeight ?? 1);
  },
};
