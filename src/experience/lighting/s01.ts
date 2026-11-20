import type { SceneRig } from './types';
export const s01 = {
  scene: 's01',
  key: { name: 'sun_window', kind: 'directional', color: '#ffdfbc', intensity: .7, position: [-4, 3, -8], target: [0, 0, 0] },
  fill: { name: 'front_fill', kind: 'directional', color: '#cfe4f4', intensity: .65, position: [2, 3, 12] },
  rim: { name: 'robot_rim', kind: 'directional', color: '#ffe7cd', intensity: .8, position: [-6, 4, 0] },
  emissive: [{ name: 'disc_glow', kind: 'point', color: '#66ffbb', intensity: 90, position: [.4, .6, -19.6], distance: 30 }],
  ambient: { color: '#9fbfc5', intensity: .14 }, fog: { color: '#182b2d', density: 0 },
  bloom: { threshold: 1, strength: .1, radius: .4 }, exposure: .9, contrast: 1, emissiveTrim: 1,
} satisfies SceneRig;
