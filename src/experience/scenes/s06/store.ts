import type { StateCreator } from 'zustand';
import type { SceneSnapshot } from '../../contracts';
import type { ExperienceStore } from '../../store';

export type S06Slice = {
  dnaValueIndex: number;
  setDnaValueIndex: (index: number) => void;
};

export const createS06Slice: StateCreator<ExperienceStore, [], [], S06Slice> = (set) => ({
  dnaValueIndex: 0,
  setDnaValueIndex: (dnaValueIndex) => set({ dnaValueIndex }),
});

export function sampleS06(snapshot: SceneSnapshot): Partial<S06Slice> {
  return typeof snapshot.visual.valueIndex === 'number' ? { dnaValueIndex: snapshot.visual.valueIndex } : {};
}
