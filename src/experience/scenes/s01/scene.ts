import { placeholder } from '../placeholder';
import { sampleIntro } from '../../robot/intro';
import type { SceneDef } from '../../contracts';

const base = placeholder('s01', 0);
export const scene: SceneDef = {
  ...base,
  sample(input) {
    const snapshot = base.sample(input);
    snapshot.camera = { position: [0, 0, 4.2], quaternion: [0, 0, 0, 1], fov: 35, near: 0.1, far: 100 };
    snapshot.visual.robotState = 'interacting';
    snapshot.robot = { kind: 'clip', name: 'Idle', timeSeconds: Math.max(0, (input.local - 0.55) / 0.45) * 4, weight: 1 };
    if (input.profile.motion === 'reduced') snapshot.robot = { kind: 'pose', name: 'rest' };
    else if (input.local === 0 && input.introSeconds !== undefined) snapshot.robot = sampleIntro(input.introSeconds, { kind: 'clip', name: 'Sleep', timeSeconds: 0, weight: 1 });
    return snapshot;
  },
};
