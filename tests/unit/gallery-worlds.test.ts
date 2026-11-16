import { describe, expect, it } from 'vitest';
import manifest from '../../assets-model/export/worlds.manifest.json';
import { worldAnimations } from '../../src/experience/scenes/s05/worlds';
import { nodeState, writeMotion, type WorldInput } from '../../src/experience/scenes/s05/worlds/motion';

const input: WorldInput = { reducedMotion: false, time: 2.4, screenCount: 3 };
describe.each(manifest.worlds)('$slug deterministic mini-world', world => {
  const definition = worldAnimations[world.slug as keyof typeof worldAnimations];
  it('matches direct, forward and reverse evaluation at 20 points without mutating input', () => {
    const before = structuredClone(input);
    const points = Array.from({ length: 20 }, (_, i) => i / 19);
    const direct = points.map(local => definition.animate(local, input));
    expect(points.map(local => definition.animate(local, input))).toEqual(direct);
    expect(points.toReversed().map(local => definition.animate(local, input)).reverse()).toEqual(direct);
    expect(input).toEqual(before);
    for (const result of direct) expect(JSON.parse(JSON.stringify(result))).toEqual(result);
  });
  it('references only authored nodes, includes every float flag and animates all three screens', () => {
    const names = new Set(world.nodes.map(node => node.name));
    const nodes = definition.animate(.6, input).nodes;
    for (const name of Object.keys(nodes)) expect(names.has(name)).toBe(true);
    for (const node of world.nodes) if ('float_bob' in node && node.float_bob) expect(nodes[node.name]).toBeDefined();
    for (const name of world.screen_planes) expect(nodes[name].screen).toBeDefined();
    expect(definition.animate(.1, input)).not.toEqual(definition.animate(.7, input));
  });
  it('keeps every transform and screen static with reduced motion, regardless of time or seek', () => {
    const still = definition.animate(0, { ...input, reducedMotion: true, time: 0 });
    for (let i = 0; i < 20; i++) expect(definition.animate(i / 19, { ...input, reducedMotion: true, time: i * 3 })).toEqual(still);
  });
  it('uses the same math with reusable runtime buffers, including reverse seeks', () => {
    const buffers = definition.motions.map(() => nodeState());
    for (const local of [.2, .8, .4, 0, 1]) {
      const sampled = definition.animate(local, input);
      definition.motions.forEach((motion, index) => {
        writeMotion(buffers[index], motion, local, input);
        expect(buffers[index]).toEqual(sampled.nodes[motion.name]);
      });
    }
  });
});

it('crossfades only real image indices, holds a single image, and provides named-card slots without images', () => {
  for (const count of [1, 2, 3]) for (let i = 0; i < 20; i++) {
    const nodes = worldAnimations.loryfy.animate(i / 19, { ...input, screenCount: count }).nodes;
    for (const name of ['ScreenPlane_1', 'ScreenPlane_2', 'ScreenPlane_3']) {
      const screen = nodes[name].screen;
      expect(screen.from).toBeLessThan(count); expect(screen.to).toBeLessThan(count);
      expect(screen.mix).toBeGreaterThanOrEqual(0); expect(screen.mix).toBeLessThanOrEqual(1);
    }
  }
  const nodes = worldAnimations.loryfy.animate(.05, { ...input, time: 0 }).nodes;
  expect(nodes.ScreenPlane_1.screen.mix).toBe(0);
  expect(worldAnimations.loryfy.animate(.3, { ...input, time: 0 }).nodes.ScreenPlane_1.screen.mix).toBeGreaterThan(0);
  expect(worldAnimations['alhumairi-hajj'].animate(.5, input).nodes.CubeMonument).toBeUndefined();
});
