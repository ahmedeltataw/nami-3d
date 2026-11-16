import { assertCount, seededRandom } from './random';

export type Point3 = [number, number, number];
export type TargetFunction = (seed: number, index: number) => Point3;
export type ParticleAttributes = {
  start: Float32Array;
  target: Float32Array;
  phase: Float32Array;
  size: Float32Array;
  tint: Float32Array;
};

export function particleAttribute(seed: number, index: number, targetFn?: TargetFunction) {
  const random = seededRandom((seed >>> 0) ^ Math.imul(index + 1, 0x9e3779b1));
  const start: Point3 = [Math.fround((random() - 0.5) * 6), Math.fround((random() - 0.5) * 4), Math.fround((random() - 0.5) * 4)];
  const target: Point3 = targetFn?.(seed, index) ?? [start[0] * 0.25, start[1] * 0.25, start[2] * 0.25];
  return {
    start, target: target.map(Math.fround) as Point3,
    phase: Math.fround(random() * Math.PI * 2),
    size: Math.fround(1.5 + random() * 2),
    tint: Math.floor(random() * 3),
  };
}

export function createParticleAttributes(count: number, seed: number, targetFn?: TargetFunction): ParticleAttributes {
  assertCount(count);
  const attributes: ParticleAttributes = {
    start: new Float32Array(count * 3), target: new Float32Array(count * 3),
    phase: new Float32Array(count), size: new Float32Array(count), tint: new Float32Array(count),
  };
  for (let index = 0; index < count; index++) {
    const particle = particleAttribute(seed, index, targetFn);
    attributes.start.set(particle.start, index * 3);
    attributes.target.set(particle.target, index * 3);
    attributes.phase[index] = particle.phase;
    attributes.size[index] = particle.size;
    attributes.tint[index] = particle.tint;
  }
  return attributes;
}
