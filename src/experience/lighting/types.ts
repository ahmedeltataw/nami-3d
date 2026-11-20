import type { SceneId } from '../contracts';

export type LightSpec = {
  name: string;
  kind: 'directional' | 'point';
  color: string;
  intensity: number;
  position: [number, number, number];
  target?: [number, number, number];
  distance?: number;
};
export type SceneRig = {
  scene: SceneId;
  key: LightSpec;
  fill: LightSpec;
  rim: LightSpec;
  emissive: readonly LightSpec[];
  ambient: { color: string; intensity: number };
  fog: { color: string; density: number };
  bloom: { threshold: number; strength: number; radius: number };
  exposure: number;
  contrast: number;
  emissiveTrim: number;
};
