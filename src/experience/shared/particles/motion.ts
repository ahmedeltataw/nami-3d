import { particleAttribute, type ParticleAttributes, type Point3 } from './attributes';
import { getPresets, writePresetWeights, type PresetSelection } from './presets';

export type ParticleFrame = {
  progress: number;
  time: number;
  pointer?: readonly [number, number, number];
  preset?: PresetSelection;
};
export type ParticleReferenceState = ParticleFrame & {
  seed: number;
  motion?: 'full' | 'reduced';
  attributes?: ParticleAttributes;
  targets?: Float32Array;
};

export function clampProgress(progress: number): number { return Math.max(0, Math.min(1, progress)); }

/** Matches --ease-cinematic: cubic-bezier(0.65, 0, 0.35, 1). */
export function cinematic(progress: number): number {
  const x = clampProgress(progress);
  if (x === 0 || x === 1) return x;
  let t = x;
  for (let iteration = 0; iteration < 6; iteration++) {
    t -= (t * (1.95 + t * (-2.85 + 1.9 * t)) - x) / (1.95 + t * (-5.7 + 5.7 * t));
  }
  return t * t * (3 - 2 * t);
}

/** Stateless reference for the three built-ins; custom GLSL needs its own reference. */
export function particlePosition(index: number, state: ParticleReferenceState): Point3 {
  if (!Number.isSafeInteger(index) || index < 0) throw new RangeError('Invalid particle index');
  const attributes = state.attributes;
  if (attributes && index >= attributes.phase.length) throw new RangeError('Particle index exceeds attributes');
  const generated = attributes ? undefined : particleAttribute(state.seed, index);
  const offset = index * 3;
  const start = attributes ? attributes.start.subarray(offset, offset + 3) : generated!.start;
  const targets = state.targets ?? attributes?.target;
  if (targets && targets.length < offset + 3) throw new RangeError('Target buffer is too small');
  const target = targets ? targets.subarray(offset, offset + 3) : generated!.target;
  const phase = attributes ? attributes.phase[index] : generated!.phase;
  const progress = clampProgress(state.progress);
  const time = state.motion === 'reduced' ? 0 : state.time;
  const presets = getPresets();
  const weights = new Float32Array(presets.length);
  writePresetWeights(state.preset ?? 'ambient', presets, weights);
  const result: Point3 = [0, 0, 0];
  for (let presetIndex = 0; presetIndex < presets.length; presetIndex++) {
    const weight = weights[presetIndex];
    if (weight === 0) continue;
    let p: Point3;
    switch (presets[presetIndex].id) {
      case 'ambient': p = [
        start[0] + 0.18 * (Math.sin(time * 0.15 + phase) - Math.sin(phase)),
        start[1] + 0.18 * (Math.sin(time * 0.12 + phase * 1.7) - Math.sin(phase * 1.7)),
        start[2] + 0.18 * (Math.cos(time * 0.1 + phase) - Math.cos(phase)),
      ]; break;
      case 'converge': {
        const t = cinematic(progress);
        p = progress === 0 ? [...start] as Point3 : progress === 1 ? [...target] as Point3
          : [start[0] * (1 - t) + target[0] * t, start[1] * (1 - t) + target[1] * t, start[2] * (1 - t) + target[2] * t];
        break;
      }
      case 'dissolve': {
        const scatter = progress * progress * 3;
        const length = Math.max(Math.hypot(...start), 0.0001);
        const radial = [start[0] / length, start[1] / length, start[2] / length];
        const noise = [Math.sin(phase * 2.3 + time * 0.1), Math.cos(phase * 1.7 + time * 0.13), Math.sin(phase * 3.1 - time * 0.09)];
        const inward = Math.min(0, noise[0] * radial[0] + noise[1] * radial[1] + noise[2] * radial[2]);
        p = [0, 0, 0];
        for (let axis = 0; axis < 3; axis++) p[axis] = start[axis] + scatter * (radial[axis] + (noise[axis] - radial[axis] * inward) * 0.35);
        break;
      }
      default: throw new Error(`No CPU reference for custom particle preset: ${presets[presetIndex].id}`);
    }
    for (let axis = 0; axis < 3; axis++) result[axis] += p[axis] * weight;
  }
  for (let axis = 0; axis < 3; axis++) result[axis] += (state.pointer?.[axis] ?? 0) * progress * (1 - progress) * 0.15;
  return result;
}
