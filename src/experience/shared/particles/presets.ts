import type { IUniform } from 'three';
import type { TargetFunction } from './attributes';

/** vertexChunk is a GLSL statement body: read position/aTarget/aPhase and write p. */
export type ParticlePreset = {
  id: string;
  vertexChunk: string;
  uniforms: Record<string, IUniform>;
  targetFn?: TargetFunction;
};
export type PresetSelection = string | Readonly<Record<string, number>>;

const registry = new Map<string, ParticlePreset>();
const reserved = new Set(['uProgress', 'uTime', 'uPreset', 'uPointer', 'uDpr', 'uOpacity']);

export function registerPreset(preset: ParticlePreset): void {
  if (!preset.id.trim() || !preset.vertexChunk.trim()) throw new Error('A preset needs an id and vertexChunk');
  if (registry.has(preset.id)) throw new Error(`Particle preset already registered: ${preset.id}`);
  for (const name of Object.keys(preset.uniforms)) {
    if (!/^[a-zA-Z_]\w*$/.test(name) || reserved.has(name)) throw new Error(`Reserved or invalid particle uniform: ${name}`);
    for (const existing of registry.values()) {
      if (name in existing.uniforms) throw new Error(`Particle uniform already registered: ${name}`);
    }
  }
  registry.set(preset.id, preset);
}

export function getPreset(id: string): ParticlePreset | undefined { return registry.get(id); }
export function getPresets(): ParticlePreset[] { return [...registry.values()]; }

export function writePresetWeights(selection: PresetSelection, presets: readonly ParticlePreset[], weights: Float32Array): void {
  if (typeof selection === 'string') {
    let found = false;
    for (let index = 0; index < presets.length; index++) if (presets[index].id === selection) found = true;
    if (!found) throw new Error(`Unknown particle preset: ${selection}`);
  } else {
    for (const id in selection) {
      let found = false;
      for (let index = 0; index < presets.length; index++) if (presets[index].id === id) found = true;
      if (!found) throw new Error(`Unknown particle preset: ${id}`);
      if (!Number.isFinite(selection[id]) || selection[id] < 0) throw new RangeError('Preset weights must be finite and non-negative');
    }
  }
  let total = 0;
  for (let index = 0; index < presets.length; index++) {
    const weight = typeof selection === 'string' ? Number(presets[index].id === selection) : selection[presets[index].id] ?? 0;
    total += weight;
  }
  if (!Number.isFinite(total) || total <= 0) throw new RangeError('At least one particle preset weight must be positive');
  for (let index = 0; index < presets.length; index++) {
    const weight = typeof selection === 'string' ? Number(presets[index].id === selection) : selection[presets[index].id] ?? 0;
    weights[index] = weight / total;
  }
}

registerPreset({ id: 'ambient', uniforms: {}, vertexChunk: `
  p = position + 0.18 * vec3(
    sin(uTime * 0.15 + aPhase) - sin(aPhase),
    sin(uTime * 0.12 + aPhase * 1.7) - sin(aPhase * 1.7),
    cos(uTime * 0.1 + aPhase) - cos(aPhase));
` });
registerPreset({ id: 'converge', uniforms: {}, vertexChunk: `
  if (uProgress <= 0.0) p = position;
  else if (uProgress >= 1.0) p = aTarget;
  else p = mix(position, aTarget, cinematic(uProgress));
` });
registerPreset({ id: 'dissolve', uniforms: {}, vertexChunk: `
  vec3 radial = position / max(length(position), 0.0001);
  vec3 noise = vec3(
    sin(aPhase * 2.3 + uTime * 0.1),
    cos(aPhase * 1.7 + uTime * 0.13),
    sin(aPhase * 3.1 - uTime * 0.09));
  noise -= radial * min(0.0, dot(noise, radial));
  p = position + uProgress * uProgress * 3.0 * (radial + noise * 0.35);
` });
registerPreset({ id: 'swirl', uniforms: {}, vertexChunk: `
  float t = cinematic(uProgress);
  float angle = 6.28318530718 * t;
  vec3 spun = vec3(cos(angle) * position.x - sin(angle) * position.z, position.y, sin(angle) * position.x + cos(angle) * position.z);
  p = mix(spun, aTarget, t);
  if (uProgress <= 0.0) p = position;
  if (uProgress >= 1.0) p = aTarget;
` });
registerPreset({ id: 'explode', uniforms: {}, vertexChunk: `
  vec3 radial = length(position) > 0.0001 ? normalize(position) : vec3(cos(aPhase), sin(aPhase), 0.0);
  p = position + radial * (3.0 * cinematic(uProgress));
` });
registerPreset({ id: 'orbit', uniforms: {}, vertexChunk: `
  float angle = 6.28318530718 * cinematic(uProgress);
  vec3 offset = position - aTarget;
  p = aTarget + vec3(cos(angle) * offset.x - sin(angle) * offset.z, offset.y, sin(angle) * offset.x + cos(angle) * offset.z);
  if (uProgress <= 0.0 || uProgress >= 1.0) p = position;
` });
