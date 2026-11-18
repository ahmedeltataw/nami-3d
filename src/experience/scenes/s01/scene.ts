import { clamp } from '../../controller';
import { INTRO_END, sampleIntro } from '../../robot/intro';
import type { SceneDef } from '../../contracts';
import { SCENE_HEROES } from '../manifests';
import { headlineReveal } from './headline';

const ramp = (value: number, start: number, end: number) => clamp((value - start) / (end - start));
const HERO = SCENE_HEROES.s01;

export const scene: SceneDef = {
  id: 's01', assets: ['poster:s01', 's01.kit'], poster: '/posters/s01.svg',
  sample(input) {
    const local = clamp(input.local);
    const reduced = input.profile.motion === 'reduced';
    const intro = !reduced && local === 0 && input.introSeconds !== undefined && input.introSeconds < INTRO_END;
    const seconds = intro ? input.introSeconds! : INTRO_END;
    const dolly = reduced ? (local >= 1 ? 1 : 0) : ramp(local, 0.55, 1);
    const wake = ramp(seconds, 0, 1.2);
    const drawing = intro ? ramp(seconds, 3.4, INTRO_END) : local === 0 ? 1 : ramp(local, 0, .35);
    const heroPoseActive = !intro && !(local > 0 && local < .35) && dolly === 0;
    return {
      camera: {
        position: [
          HERO.camera.position[0],
          HERO.camera.position[1],
          HERO.camera.position[2] - 2.4 * dolly,
        ],
        quaternion: [...HERO.camera.quaternion],
        fov: HERO.camera.fov,
        near: HERO.camera.near,
        far: HERO.camera.far,
      },
      robot: reduced ? { kind: 'pose', name: 'rest' }
        : intro ? sampleIntro(seconds, { kind: 'clip', name: 'Sleep', timeSeconds: 0, weight: 1 })
          : local > 0 && local < .35 ? { kind: 'clip', name: 'Draw', timeSeconds: drawing * 1.2, weight: 1 }
          : { kind: 'clip', name: dolly > 0 ? 'ChargeEnergy' : 'Idle', timeSeconds: 0, weight: 1 },
      visual: {
        robotState: 'interacting',
        robotPosition: [
          HERO.robot.rootPosition[0] - 0.55 * dolly,
          HERO.robot.rootPosition[1],
          HERO.robot.rootPosition[2],
        ],
        robotQuaternion: [...HERO.robot.quaternion],
        robotScale: HERO.robot.scale,
        robotPose: heroPoseActive ? HERO.robot.jointPosesXyzw : undefined,
        robotX: -0.55 * dolly,
        eyeOpen: wake * (1 - 0.25 * dolly),
        headPitch: intro && seconds < 1.2 ? (1 - wake) * -8 * Math.PI / 180 : undefined,
        focus: dolly,
        headlineExit: dolly,
        subtitleEmphasis: ramp(local, 0.35, 0.55),
        scrollHint: (intro ? 0 : 1) * (1 - dolly),
        discover: intro && seconds >= 1 && seconds < 1.8,
        line: reduced ? 0 : drawing,
        headlineReveal: reduced ? 100 : headlineReveal(drawing),
      },
    };
  },
  apply() {},
};
