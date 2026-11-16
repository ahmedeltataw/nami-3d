import type { StateCreator } from 'zustand';
import type { SceneSnapshot } from '../../contracts';
import type { ExperienceStore } from '../../store';

export type S03Slice = {
  station: number;
};

export const createS03Slice: StateCreator<ExperienceStore, [], [], S03Slice> = () => ({
  station: 1,
});

export function sampleS03(snapshot: SceneSnapshot): Partial<S03Slice> {
  return typeof snapshot.visual.station === 'number' ? { station: snapshot.visual.station } : {};
}
