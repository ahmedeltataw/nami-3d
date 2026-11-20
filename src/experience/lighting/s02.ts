import type { SceneRig } from './types';
export const s02 = {
  scene: 's02',
  key: { name: 'key_left', kind: 'directional', color: '#edf9ff', intensity: 1.2, position: [-3, 9, -1], target: [3, 2, -8] },
  fill: { name: 'floor_fill', kind: 'directional', color: '#a0ffc4', intensity: .55, position: [4, 2.5, -7.5] },
  rim: { name: 'rim_right', kind: 'directional', color: '#d9f3f3', intensity: .9, position: [13, 7, -6] },
  emissive: [
    { name: 'tunnel_inner', kind: 'point', color: '#a0ffc4', intensity: 20, position: [5.6, 3.4, -17.5], distance: 18 },
    { name: 'amber_pool', kind: 'point', color: '#ffcb95', intensity: 15, position: [-1, -.5, -4.5], distance: 12 },
  ],
  ambient: { color: '#38534f', intensity: .18 }, fog: { color: '#639578', density: .012 },
  bloom: { threshold: 1, strength: .12, radius: .45 }, exposure: .85, contrast: 1.12, emissiveTrim: 1,
} satisfies SceneRig;
