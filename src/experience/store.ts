import { create } from 'zustand';
import type { Profile, RobotDirective, SceneId } from './contracts';

type ExperienceStore = {
  scene: SceneId;
  station: number;
  robotState: RobotDirective;
  profile: Profile;
  ui: { ready: boolean; contextLost: boolean };
};

export const useExperienceStore = create<ExperienceStore>(() => ({
  scene: 's01',
  station: 1,
  robotState: { kind: 'rest' },
  profile: { quality: 'mid', motion: 'full', renderer: 'fallback' },
  ui: { ready: false, contextLost: false },
}));
