import type { SceneRig } from './types';
export const s05 = {
  scene: 's05',
  key: { name: 'globe_key', kind: 'point', color: '#95ffd3', intensity: 40, position: [-.2, 3.6, 1], distance: 20 },
  fill: { name: 'front_fill', kind: 'directional', color: '#e7f9ff', intensity: .8, position: [-2, 3.6, 18] },
  rim: { name: 'robot_rim', kind: 'directional', color: '#a0ffda', intensity: 1.1, position: [-1, 4, 6.5] },
  emissive: [
    { name: 'platform_glow', kind: 'point', color: '#a0ffcb', intensity: 15, position: [0, 1.2, 1.5], distance: 12 },
    { name: 'drum_fill', kind: 'point', color: '#e7fff9', intensity: 12, position: [.5, 1, 9], distance: 18 },
    { name: 'ceiling_warm', kind: 'directional', color: '#ffedcf', intensity: .45, position: [0, 5.8, 6] },
  ],
  ambient: { color: '#528d7c', intensity: .25 }, fog: { color: '#498872', density: .007 },
  bloom: { threshold: 1, strength: .12, radius: .5 }, exposure: .85, contrast: 1.12, emissiveTrim: 1,
} satisfies SceneRig;
