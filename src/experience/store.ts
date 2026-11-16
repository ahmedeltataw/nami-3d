import { create } from 'zustand';
import type { Profile, RobotDirective, SceneId } from './contracts';
import type { DirectorState } from './director';

export type ProjectType = 'website' | 'mobile' | 'marketing' | 'other';

export type ControllerApi = {
  seek: (scene: SceneId, local?: number, updateHistory?: boolean) => void;
  position?: () => { scene: SceneId; local: number };
  recalculate?: () => void;
};

type ExperienceStore = {
  director: DirectorState;
  scene: SceneId;
  station: number;
  cursorGrab: boolean;
  dnaValueIndex: number;
  setDnaValueIndex: (index: number) => void;
  projectType: ProjectType | null;
  setProjectType: (projectType: ProjectType | null) => void;
  project: number;
  robotState: RobotDirective;
  profile: Profile;
  ui: { ready: boolean; contextLost: boolean };
  controller: ControllerApi | null;
};

export const useExperienceStore = create<ExperienceStore>((set) => ({
  director: 'idle',
  scene: 's01',
  station: 1,
  cursorGrab: false,
  dnaValueIndex: 0,
  setDnaValueIndex: (dnaValueIndex) => set({ dnaValueIndex }),
  projectType: null,
  setProjectType: (projectType) => set({ projectType }),
  project: 0,
  robotState: { kind: 'rest' },
  profile: { quality: 'mid', motion: 'full', renderer: 'fallback' },
  ui: { ready: false, contextLost: false },
  controller: null,
}));
