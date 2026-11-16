import { expect, it } from 'vitest';
import { createParticleAttributes } from '../../src/experience/shared/particles/attributes';
import { particlePosition } from '../../src/experience/shared/particles/motion';
import { getPreset } from '../../src/experience/shared/particles/presets';

for (const preset of ['swirl', 'explode', 'orbit']) {
  it(`${preset} has defined endpoints and is independent of time and traversal order`, () => {
    expect(getPreset(preset)).toBeDefined();
    const attributes = createParticleAttributes(20, 42);
    for (let i = 0; i < 20; i++) {
      const position = (progress: number, time = 0) => particlePosition(i, { seed: 42, attributes, preset, progress, time });
      const start = Array.from(attributes.start.slice(i * 3, i * 3 + 3));
      const target = Array.from(attributes.target.slice(i * 3, i * 3 + 3));
      expect(position(0)).toEqual(start);
      const end = position(1);
      if (preset === 'swirl') expect(end).toEqual(target);
      else if (preset === 'orbit') expect(end).toEqual(start);
      else {
        const length = Math.hypot(...start);
        end.forEach((value, axis) => expect(value).toBeCloseTo(start[axis] + start[axis] / length * 3, 10));
      }
      const times = [0, .1, .35, .5, .9, 1];
      const direct = times.map(p => position(p));
      expect(times.toReversed().map(p => position(p, 987)).toReversed()).toEqual(direct);
      expect(position(.35)).not.toEqual(start);
    }
  });
}
