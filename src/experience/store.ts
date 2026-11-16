import { create } from 'zustand';
import type { Profile, RobotDirective, SceneId } from './contracts';

export type ControllerApi = {
  seek: (scene: SceneId, local?: number, updateHistory?: boolean) => void;
  recalculate?: () => void;
};

type ExperienceStore = {
  scene: SceneId;
  station: number;
  cursorGrab: boolean;
  robotState: RobotDirective;
  profile: Profile;
  ui: { ready: boolean; contextLost: boolean };
  controller: ControllerApi | null;
};

export const useExperienceStore = create<ExperienceStore>(() => ({
  scene: 's01',
  station: 1,
  cursorGrab: false,
  robotState: { kind: 'rest' },
  profile: { quality: 'mid', motion: 'full', renderer: 'fallback' },
  ui: { ready: false, contextLost: false },
  controller: null,
}));
