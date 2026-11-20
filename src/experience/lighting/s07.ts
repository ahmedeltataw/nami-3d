import type { SceneRig } from './types';
export const s07 = {
  scene: 's07',
  key: { name: 'sun', kind: 'directional', color: '#ffdaB3', intensity: 3.2, position: [7, 1.74, -7] },
  fill: { name: 'cool_fill', kind: 'directional', color: '#c4d7ed', intensity: .65, position: [-7, 4, 12] },
  rim: { name: 'rim', kind: 'directional', color: '#ffcfa3', intensity: 0, position: [8, 2, -8] },
  emissive: [],
  ambient: { color: '#597795', intensity: 1.1 }, fog: { color: '#597795', density: 0 },
  bloom: { threshold: 1, strength: .15, radius: .45 }, exposure: 1, contrast: 1, emissiveTrim: 1,
} satisfies SceneRig;
