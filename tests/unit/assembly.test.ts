import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import type { SampleInput } from '../../src/experience/contracts';
import { scene, LAB_INTRO_END, LAB_EXIT_START, STATION_SPAN, stationSeekLocal } from '../../src/experience/scenes/s03/scene';
import { scene as s04 } from '../../src/experience/scenes/s04/scene';
import { cameraPoses } from '../../src/experience/scenes/s03/station';
import { headlineReveal } from '../../src/experience/scenes/s01/headline';
import { scene as s01 } from '../../src/experience/scenes/s01/scene';

const input: SampleInput = { local: 0, viewport: { w: 1280, h: 800, dpr: 1 }, profile: { quality: 'high', motion: 'full', renderer: 'webgl' }, interaction: { source: null, token: 0, reaction: null }, seed: 1, ambient: 0 };
const sample = (local: number) => scene.sample({ ...input, local });

describe('lab assembly camera', () => {
  it('keeps position and quaternion continuous on both sides of every window and arrival edge', () => {
    const edges = [0, LAB_INTRO_END, LAB_EXIT_START, 1];
    for (let i = 0; i < 6; i++) edges.push(LAB_INTRO_END + i * STATION_SPAN, LAB_INTRO_END + (i + .2) * STATION_SPAN);
    for (const edge of edges) {
      const center = sample(edge).camera;
      for (const offset of [-1e-7, 1e-7]) {
        const neighbor = sample(Math.max(0, Math.min(1, edge + offset))).camera;
        expect(new Vector3(...neighbor.position).distanceTo(new Vector3(...center.position)), `position at ${edge}`).toBeLessThan(1e-4);
        expect(new Quaternion().fromArray(neighbor.quaternion).angleTo(new Quaternion().fromArray(center.quaternion)), `rotation at ${edge}`).toBeLessThan(1e-4);
        neighbor.quaternion.forEach((value, i) => expect(Math.abs(value - center.quaternion[i])).toBeLessThan(1e-4));
        const lights = sample(edge).visual.lights as number[];
        (sample(Math.max(0, Math.min(1, edge + offset))).visual.lights as number[]).forEach((value, i) => expect(Math.abs(value - lights[i])).toBeLessThan(1e-4));
      }
    }
  });
  it('visits all six anchors and ends at the exact S04 entry, in either sampling direction', () => {
    const times = Array.from({ length: 101 }, (_, i) => i / 100);
    expect(times.toReversed().map(sample).toReversed()).toEqual(times.map(sample));
    for (let id = 1; id <= 6; id++) {
      expect(sample(stationSeekLocal(id)).camera).toEqual(cameraPoses[id - 1]);
      expect(sample(stationSeekLocal(id)).visual.station).toBe(id);
    }
    expect(sample(0).robot).toMatchObject({ name: 'Fly', timeSeconds: 0 });
    expect(sample(.025).visual.robotPosition).not.toEqual(sample(0).visual.robotPosition);
    expect(sample(1).camera).toEqual(s04.sample(input).camera);
    expect(scene.sample({ ...input, local: 1, profile: { ...input.profile, motion: 'reduced' } }).camera).toEqual(s04.sample(input).camera);
  });
});

describe('HTML headline reveal', () => {
  it('maps endpoints to percentages and monotonically replays in reverse', () => {
    expect(headlineReveal(0)).toBe(0);
    expect(headlineReveal(1)).toBe(100);
    expect(headlineReveal(-1)).toBe(0);
    expect(headlineReveal(2)).toBe(100);
    const values = Array.from({ length: 21 }, (_, i) => headlineReveal(i / 20));
    expect(values).toEqual([...values].sort((a, b) => a - b));
    expect(values.toReversed()).toEqual(Array.from({ length: 21 }, (_, i) => headlineReveal((20 - i) / 20)));
    expect(s01.sample({ ...input, local: .1 }).robot).toMatchObject({ name: 'Draw' });
    expect(s01.sample({ ...input, local: .1, profile: { ...input.profile, motion: 'reduced' } }).visual).toMatchObject({ headlineReveal: 100, line: 0 });
  });
});
