import { AdditiveBlending, BufferAttribute, BufferGeometry, DynamicDrawUsage, ShaderMaterial, UniformsUtils, Vector3 } from 'three';
import type { Profile } from '../../profile';
import { createParticleAttributes, type TargetFunction } from './attributes';
import { clampProgress, type ParticleFrame } from './motion';
import { getPreset, getPresets, writePresetWeights, type PresetSelection } from './presets';
import { particleFragmentShader, particleVertexShader } from './shaders';

export const PARTICLE_COUNTS = { high: 20_000, mid: 8_000, low: 2_500 } as const;

export function createParticleCore({ quality, seed = 1, preset = 'ambient', targetFn }: {
  quality: Profile['quality']; seed?: number; preset?: PresetSelection; targetFn?: TargetFunction;
}) {
  const presets = getPresets();
  const weights = new Float32Array(presets.length);
  writePresetWeights(preset, presets, weights);
  const attributes = createParticleAttributes(PARTICLE_COUNTS[quality], seed,
    targetFn ?? (typeof preset === 'string' ? getPreset(preset)?.targetFn : undefined));
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(attributes.start, 3));
  geometry.setAttribute('aTarget', new BufferAttribute(attributes.target, 3).setUsage(DynamicDrawUsage));
  geometry.setAttribute('aPhase', new BufferAttribute(attributes.phase, 1));
  geometry.setAttribute('aSize', new BufferAttribute(attributes.size, 1));
  geometry.setAttribute('aTint', new BufferAttribute(attributes.tint, 1));
  const uniforms = {
    ...UniformsUtils.clone(Object.assign({}, ...presets.map(entry => entry.uniforms))),
    uProgress: { value: 0 }, uTime: { value: 0 }, uPreset: { value: weights },
    uPointer: { value: new Vector3() }, uDpr: { value: 1 }, uOpacity: { value: 0.65 },
  };
  const material = new ShaderMaterial({
    uniforms, vertexShader: particleVertexShader(presets), fragmentShader: particleFragmentShader,
    transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  return {
    attributes, geometry, material,
    /** Copies into the existing GPU attribute; caller can reuse its source buffer. */
    setTargets(targets: Float32Array) {
      if (targets.length !== attributes.target.length) throw new RangeError(`Expected ${attributes.target.length / 3} target points`);
      for (let index = 0; index < targets.length; index++) {
        if (!Number.isFinite(targets[index])) throw new RangeError('Targets must be finite');
      }
      attributes.target.set(targets);
      geometry.getAttribute('aTarget').needsUpdate = true;
    },
    setPreset(selection: PresetSelection) { writePresetWeights(selection, presets, weights); },
    /** No arrays, vectors, material instances or particle buffers are created here. */
    update(frame: ParticleFrame, dpr: number, reducedMotion: boolean) {
      uniforms.uProgress.value = clampProgress(frame.progress);
      uniforms.uTime.value = reducedMotion ? 0 : frame.time;
      uniforms.uDpr.value = dpr;
      uniforms.uPointer.value.set(frame.pointer?.[0] ?? 0, frame.pointer?.[1] ?? 0, frame.pointer?.[2] ?? 0);
      if (frame.preset !== undefined) writePresetWeights(frame.preset, presets, weights);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
export type ParticleCore = ReturnType<typeof createParticleCore>;
