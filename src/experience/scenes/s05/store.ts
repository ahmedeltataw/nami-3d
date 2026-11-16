import type { StateCreator } from 'zustand';
import type { SceneSnapshot } from '../../contracts';
import type { ExperienceStore } from '../../store';

export type S05Slice = {
  project: number;
};

export const createS05Slice: StateCreator<ExperienceStore, [], [], S05Slice> = () => ({
  project: 0,
});

export function sampleS05(snapshot: SceneSnapshot): Partial<S05Slice> {
  const project = Number(snapshot.visual.project);
  return project >= 0 ? { project } : {};
}
