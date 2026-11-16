import { describe, expect, it, vi } from 'vitest';
import { AdditiveBlending, BufferAttribute, BufferGeometry, SphereGeometry, Vector3 } from 'three';
import { createParticleAttributes, particleAttribute } from '../../src/experience/shared/particles/attributes';
import { seededRandom } from '../../src/experience/shared/particles/random';
import { sampleMeshSurface } from '../../src/experience/shared/particles/sampleMeshSurface';
import { cinematic, particlePosition } from '../../src/experience/shared/particles/motion';
import { createParticleCore, PARTICLE_COUNTS } from '../../src/experience/shared/particles/core';
import { getPreset, getPresets, registerPreset } from '../../src/experience/shared/particles/presets';

describe('deterministic particle inputs', () => {
  it('replays seeded PRNG streams without touching Math.random', () => {
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Unseeded random'); });
    try {
      const a = seededRandom(42), b = seededRandom(42), c = seededRandom(43);
      const values = Array.from({ length: 1000 }, () => a());
      expect(values).toEqual(Array.from({ length: 1000 }, () => b()));
      expect(values).not.toEqual(Array.from({ length: 1000 }, () => c()));
      expect(values.every(value => value >= 0 && value < 1)).toBe(true);
      const attributes = createParticleAttributes(12, 42);
      expect(attributes).toEqual(createParticleAttributes(12, 42));
      expect(attributes.start).not.toEqual(createParticleAttributes(12, 43).start);
      expect(attributes.start).toEqual(createParticleAttributes(20, 42).start.slice(0, 36));
    } finally { random.mockRestore(); }
  });

  it('uses custom target functions and rejects invalid counts', () => {
    const attributes = createParticleAttributes(3, 7, (seed, i) => [seed, i, -i]);
    expect(Array.from(attributes.target)).toEqual([7, 0, -0, 7, 1, -1, 7, 2, -2]);
    expect(() => createParticleAttributes(-1, 0)).toThrow(RangeError);
  });
});

describe('mesh surface sampling', () => {
  it('selects triangles by area, including non-indexed and degenerate triangles', () => {
    const geometry = new BufferGeometry();
    // Disjoint triangles with area 0, 0.5 and 4.5 (1:9 for the non-degenerate faces).
    geometry.setAttribute('position', new BufferAttribute(new Float32Array([
      0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      10, 0, 0, 13, 0, 0, 10, 3, 0,
    ]), 3));
    const samples = sampleMeshSurface(geometry, 20_000, 13);
    let large = 0;
    for (let i = 0; i < samples.length; i += 3) {
      if (samples[i] >= 10) large++;
      expect(samples[i + 2]).toBe(0);
    }
    expect(large / 20_000).toBeCloseTo(0.9, 2);
    geometry.dispose();
  });

  it('has stable count/seed prefixes and approximately uniform sphere radius and directions', () => {
    const sphere = new SphereGeometry(2, 64, 32);
    const samples = sampleMeshSurface(sphere, 8000, 23);
    expect(samples.length).toBe(24_000);
    expect(samples).toEqual(sampleMeshSurface(sphere, 8000, 23));
    expect(samples.slice(0, 300)).toEqual(sampleMeshSurface(sphere, 100, 23));
    expect(samples).not.toEqual(sampleMeshSurface(sphere, 8000, 24));
    let radius = 0;
    const sum = [0, 0, 0], second = [0, 0, 0];
    const bands = new Array<number>(8).fill(0);
    for (let i = 0; i < samples.length; i += 3) {
      const length = Math.hypot(samples[i], samples[i + 1], samples[i + 2]);
      radius += length;
      expect(length).toBeGreaterThan(1.99);
      expect(length).toBeLessThanOrEqual(2.000001);
      for (let axis = 0; axis < 3; axis++) { sum[axis] += samples[i + axis]; second[axis] += samples[i + axis] ** 2; }
      bands[Math.min(7, Math.floor((samples[i + 1] / 2 + 1) * 4))]++;
    }
    expect(radius / 8000).toBeCloseTo(2, 2);
    for (let axis = 0; axis < 3; axis++) {
      expect(Math.abs(sum[axis] / 8000)).toBeLessThan(0.04);
      expect(second[axis] / 8000).toBeCloseTo(4 / 3, 1);
    }
    for (const band of bands) expect(band).toBeGreaterThan(850);
    sphere.dispose();
  });

  it('handles empty requests and rejects unusable surfaces', () => {
    const empty = new BufferGeometry();
    expect(sampleMeshSurface(empty, 0, 1)).toEqual(new Float32Array());
    expect(() => sampleMeshSurface(empty, 1, 1)).toThrow('position');
    empty.setAttribute('position', new BufferAttribute(new Float32Array(9), 3));
    expect(() => sampleMeshSurface(empty, 1, 1)).toThrow('area');
    expect(() => sampleMeshSurface(empty, 1.5, 1)).toThrow(RangeError);
    empty.dispose();
  });
});

describe('particle reference motion', () => {
  it('has exact converge endpoints at every time, with replaced targets and pointer', () => {
    const attributes = createParticleAttributes(32, 42);
    const targets = new Float32Array(96).fill(1.25);
    for (let i = 0; i < 32; i++) {
      const state = { seed: 42, preset: 'converge', time: 123, attributes, targets, pointer: [1, -1, 0.5] as const };
      expect(particlePosition(i, { ...state, progress: 0 })).toEqual(Array.from(attributes.start.slice(i * 3, i * 3 + 3)));
      expect(particlePosition(i, { ...state, progress: 1 })).toEqual([1.25, 1.25, 1.25]);
    }
  });

  it('replays all presets and reverse traversal without accumulating history', () => {
    for (const preset of ['ambient', 'converge', 'dissolve']) {
      const progress = [0, 0.1, 0.3, 0.5, 0.7, 1];
      const forward = progress.map(value => particlePosition(7, { seed: 10, preset, progress: value, time: 4 }));
      expect(progress.toReversed().map(value => particlePosition(7, { seed: 10, preset, progress: value, time: 4 }))).toEqual(forward.toReversed());
      expect(particlePosition(7, { seed: 10, preset, progress: 0.3, time: 4 })).toEqual(forward[2]);
    }
    for (const progress of [0, 0.1, 0.25, 0.5, 0.9, 1]) expect(cinematic(progress) + cinematic(1 - progress)).toBeCloseTo(1, 12);
    expect(cinematic(0.25)).toBeCloseTo(0.070796, 5);
  });

  it('matches independently evaluated built-in math and normalized mixes', () => {
    const seed = 39, i = 4, time = 5, progress = 0.6;
    const { start, phase } = particleAttribute(seed, i);
    const scatter = progress ** 2 * 3;
    const radial = new Vector3(...start).normalize();
    const noise = new Vector3(Math.sin(phase * 2.3 + time * 0.1), Math.cos(phase * 1.7 + time * 0.13), Math.sin(phase * 3.1 - time * 0.09));
    noise.addScaledVector(radial, -Math.min(0, noise.dot(radial)));
    const expected = new Vector3(...start).addScaledVector(radial.addScaledVector(noise, 0.35), scatter).toArray();
    particlePosition(i, { seed, time, progress, preset: 'dissolve' }).forEach((value, axis) => expect(value).toBeCloseTo(expected[axis], 12));
    const ambient = particlePosition(i, { seed, time, progress, preset: 'ambient' });
    const mixed = particlePosition(i, { seed, time, progress, preset: { ambient: 2, dissolve: 2 } });
    mixed.forEach((value, axis) => expect(value).toBeCloseTo((ambient[axis] + expected[axis]) / 2, 10));
    expect(particlePosition(i, { seed, time: 99, progress, preset: 'dissolve', motion: 'reduced' }))
      .toEqual(particlePosition(i, { seed, time: 0, progress, preset: 'dissolve' }));
  });

  it('scatters outward while retaining noisy per-particle displacement', () => {
    for (let i = 0; i < 100; i++) {
      const start = particleAttribute(42, i).start;
      const scattered = particlePosition(i, { seed: 42, preset: 'dissolve', time: 8, progress: 1 });
      expect(Math.hypot(...scattered)).toBeGreaterThan(Math.hypot(...start));
    }
  });
});

describe('particle resources and preset API', () => {
  it('uses profile counts and updates only existing uniforms and target storage', () => {
    expect(PARTICLE_COUNTS).toEqual({ high: 20_000, mid: 8000, low: 2500 });
    for (const quality of ['high', 'mid', 'low'] as const) {
      const core = createParticleCore({ quality, seed: 2 });
      expect(core.geometry.getAttribute('position').count).toBe(PARTICLE_COUNTS[quality]);
      const { uniforms } = core.material;
      const pointer = uniforms.uPointer.value;
      const weights = uniforms.uPreset.value;
      const positionVersion = (core.geometry.getAttribute('position') as BufferAttribute).version;
      core.update({ progress: 0.5, time: 4, pointer: [1, 2, 3], preset: { ambient: 1, converge: 1 } }, 2, false);
      expect(core.material.uniforms).toBe(uniforms);
      expect(uniforms.uPointer.value).toBe(pointer);
      expect(uniforms.uPreset.value).toBe(weights);
      expect(pointer).toEqual(new Vector3(1, 2, 3));
      expect((core.geometry.getAttribute('position') as BufferAttribute).version).toBe(positionVersion);
      expect(uniforms.uDpr.value).toBe(2);
      core.update({ progress: 2, time: 40 }, 1.5, true);
      expect(uniforms.uTime.value).toBe(0);
      expect(uniforms.uProgress.value).toBe(1);
      expect(core.material.blending).toBe(AdditiveBlending);
      expect(core.material.depthWrite).toBe(false);
      const targetAttribute = core.geometry.getAttribute('aTarget') as BufferAttribute;
      const targets = new Float32Array(core.attributes.target.length).fill(0.75);
      core.setTargets(targets);
      targets.fill(9);
      expect(core.geometry.getAttribute('aTarget')).toBe(targetAttribute);
      expect(core.attributes.target[0]).toBe(0.75);
      expect(targetAttribute.version).toBe(1);
      expect(() => core.setTargets(new Float32Array(3))).toThrow(RangeError);
      const invalid = new Float32Array(core.attributes.target.length).fill(NaN);
      expect(() => core.setTargets(invalid)).toThrow('finite');
      expect(core.attributes.target[0]).toBe(0.75);
      expect(() => core.setPreset('missing')).toThrow('Unknown');
      expect(() => core.setPreset({ ambient: -1 })).toThrow(RangeError);
      expect(() => core.setPreset({ ambient: 0 })).toThrow(RangeError);
      const geometryDisposed = vi.fn(), materialDisposed = vi.fn();
      core.geometry.addEventListener('dispose', geometryDisposed);
      core.material.addEventListener('dispose', materialDisposed);
      core.dispose();
      expect(geometryDisposed).toHaveBeenCalledOnce();
      expect(materialDisposed).toHaveBeenCalledOnce();
    }
  });

  it('registers extensible GLSL, uniforms and target generation without core changes', () => {
    expect(getPresets().map(preset => preset.id)).toEqual(['ambient', 'converge', 'dissolve', 'swirl', 'explode', 'orbit']);
    const custom = { id: 'test-lift', vertexChunk: 'p = aTarget + vec3(0.0, uTestLift, 0.0);',
      uniforms: { uTestLift: { value: 2 } }, targetFn: (seed: number, i: number): [number, number, number] => [seed, i, 0] };
    registerPreset(custom);
    expect(getPreset('test-lift')).toBe(custom);
    expect(getPreset('missing')).toBeUndefined();
    expect(() => registerPreset(custom)).toThrow('already registered');
    expect(() => registerPreset({ id: 'reserved', vertexChunk: 'p = position;', uniforms: { uTime: { value: 1 } } })).toThrow('Reserved');
    expect(() => registerPreset({ ...custom, id: 'collision' })).toThrow('uniform already');
    const core = createParticleCore({ quality: 'low', seed: 7, preset: 'test-lift' });
    expect(core.attributes.target.slice(0, 6)).toEqual(new Float32Array([7, 0, 0, 7, 1, 0]));
    expect(core.material.vertexShader).toContain(custom.vertexChunk);
    expect(core.material.vertexShader).toContain('uniform float uTestLift;');
    expect(core.material.uniforms.uTestLift.value).toBe(2);
    core.material.uniforms.uTestLift.value = 3;
    expect(custom.uniforms.uTestLift.value).toBe(2);
    core.dispose();
  });
});
