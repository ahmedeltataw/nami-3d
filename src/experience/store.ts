import { create } from 'zustand';
import type { Profile, RobotDirective, SceneId } from './contracts';

export type ProjectType = 'website' | 'mobile' | 'marketing' | 'other';

export type ControllerApi = {
  seek: (scene: SceneId, local?: number, updateHistory?: boolean) => void;
  recalculate?: () => void;
};

type ExperienceStore = {
  scene: SceneId;
  station: number;
  dnaValueIndex: number;
  setDnaValueIndex: (index: number) => void;
  projectType: ProjectType | null;
  setProjectType: (projectType: ProjectType | null) => void;
  robotState: RobotDirective;
  profile: Profile;
  ui: { ready: boolean; contextLost: boolean };
  controller: ControllerApi | null;
};

export const useExperienceStore = create<ExperienceStore>((set) => ({
  scene: 's01',
  station: 1,
  dnaValueIndex: 0,
  setDnaValueIndex: (dnaValueIndex) => set({ dnaValueIndex }),
  projectType: null,
  setProjectType: (projectType) => set({ projectType }),
  robotState: { kind: 'rest' },
  profile: { quality: 'mid', motion: 'full', renderer: 'fallback' },
  ui: { ready: false, contextLost: false },
  controller: null,
}));
