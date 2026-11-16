import type { StateCreator } from 'zustand';
import type { ExperienceStore } from '../../store';

export type ProjectType = 'website' | 'mobile' | 'marketing' | 'other';

export type S07Slice = {
  projectType: ProjectType | null;
  setProjectType: (projectType: ProjectType | null) => void;
};

export const createS07Slice: StateCreator<ExperienceStore, [], [], S07Slice> = (set) => ({
  projectType: null,
  setProjectType: (projectType) => set({ projectType }),
});
