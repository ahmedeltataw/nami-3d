import type { SceneRig } from './types';
export const s03 = {
  scene: 's03',
  key: { name: 'ring_key', kind: 'directional', color: '#b8ffdc', intensity: 1.4, position: [0, 7, 1] },
  fill: { name: 'window_fill', kind: 'directional', color: '#ffe0b8', intensity: 1, position: [-8, 5, -10] },
  rim: { name: 'robot_rim', kind: 'directional', color: '#b2f9e2', intensity: .7, position: [6, 4, -6] },
  emissive: [],
  ambient: { color: '#729a97', intensity: .3 }, fog: { color: '#4d8c85', density: .011 },
  bloom: { threshold: .9, strength: .16, radius: .5 }, exposure: .76, contrast: 1.12, emissiveTrim: 1,
} satisfies SceneRig;
