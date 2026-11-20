import type { SceneRig } from './types';
export const s06 = {
  scene: 's06',
  key: { name: 'helix_key', kind: 'point', color: '#95ffd3', intensity: 16, position: [.168, 2.16, .72], distance: 12 },
  fill: { name: 'front_fill', kind: 'directional', color: '#e7f9ff', intensity: .65, position: [-1.2, 2.16, 10.8] },
  rim: { name: 'robot_rim', kind: 'directional', color: '#a0ffda', intensity: .8, position: [.6, 3, 2.4] },
  emissive: [
    { name: 'platform_glow', kind: 'point', color: '#a0ffcb', intensity: 6, position: [0, .72, .9], distance: 7 },
    { name: 'drum_fill', kind: 'point', color: '#e7fff9', intensity: 4, position: [.3, .54, 3.6], distance: 10 },
    { name: 'ceiling_warm', kind: 'directional', color: '#ffedcf', intensity: .35, position: [0, 3.48, 3.6] },
  ],
  ambient: { color: '#528d7c', intensity: .24 }, fog: { color: '#498872', density: .005 },
  bloom: { threshold: 1, strength: .12, radius: .5 }, exposure: .9, contrast: 1.12, emissiveTrim: 1,
} satisfies SceneRig;
