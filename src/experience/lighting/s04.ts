import type { SceneRig } from './types';
export const s04 = {
  scene: 's04',
  key: { name: 'window_dusk', kind: 'directional', color: '#ffe1da', intensity: 1, position: [-10, 4.5, -5] },
  fill: { name: 'front_fill', kind: 'directional', color: '#edf9ff', intensity: .7, position: [-1, 4, 8] },
  rim: { name: 'rim_right', kind: 'directional', color: '#caffeb', intensity: .9, position: [6, 5, 2] },
  emissive: [{ name: 'platform_glow', kind: 'point', color: '#a0ffc4', intensity: 15, position: [.2, 1.6, -.2], distance: 12 }],
  ambient: { color: '#597d79', intensity: .3 }, fog: { color: '#406b62', density: .008 },
  bloom: { threshold: 1, strength: .12, radius: .45 }, exposure: .9, contrast: 1.12, emissiveTrim: 1,
} satisfies SceneRig;
