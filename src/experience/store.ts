import { create } from 'zustand';
import type { Profile, RobotDirective, SceneId } from './contracts';
import type { DirectorState } from './director';
import { createS03Slice, type S03Slice } from './scenes/s03/store';
import { createS04Slice, type S04Slice } from './scenes/s04/store';
import { createS05Slice, type S05Slice } from './scenes/s05/store';
import { createS06Slice, type S06Slice } from './scenes/s06/store';
import { createS07Slice, type S07Slice } from './scenes/s07/store';

export type { ProjectType } from './scenes/s07/store';

export type ControllerApi = {
  seek: (scene: SceneId, local?: number, updateHistory?: boolean) => void;
  position?: () => { scene: SceneId; local: number };
  recalculate?: () => void;
};

export type ExperienceStore = {
  director: DirectorState;
  scene: SceneId;
  cursorGrab: boolean;
  robotState: RobotDirective;
  profile: Profile;
  ui: { ready: boolean; contextLost: boolean };
  controller: ControllerApi | null;
} & S03Slice & S04Slice & S05Slice & S06Slice & S07Slice;

export const useExperienceStore = create<ExperienceStore>((...args) => ({
  director: 'idle',
  scene: 's01',
  cursorGrab: false,
  robotState: { kind: 'rest' },
  profile: { quality: 'mid', motion: 'full', renderer: 'fallback' },
  ui: { ready: false, contextLost: false },
  controller: null,
  ...createS03Slice(...args),
  ...createS04Slice(...args),
  ...createS05Slice(...args),
  ...createS06Slice(...args),
  ...createS07Slice(...args),
}));
