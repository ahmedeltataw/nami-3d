import { describe, expect, it } from 'vitest';
import { ENTER, EXIT, WINDOW, projectWindow, scene } from '../../src/experience/scenes/s05/scene';
import { galleryProjects } from '../../src/experience/scenes/s05/projects';
import { getProjects } from '../../src/content';
import { acquireDestination, AssetResidency, worldKeys } from '../../src/experience/assets/residency';
import { scene as s06 } from '../../src/experience/scenes/s06/scene';
import type { SampleInput } from '../../src/experience/contracts';
import type { AssetKey } from '../../src/experience/assets/manifest';

const input: SampleInput = { local: 0, viewport: { w: 1280, h: 800, dpr: 1.5 }, profile: { quality: 'high', motion: 'full', renderer: 'webgl' }, interaction: { source: null, token: 0, reaction: null }, seed: 5, ambient: 100 };
describe('gallery timeline', () => {
  it('allocates 5% entry, six 15% windows and 5% exit', () => {
    expect(ENTER + 6 * WINDOW).toBeCloseTo(EXIT);
    expect(ENTER + 6 * WINDOW + (1 - EXIT)).toBeCloseTo(1);
    expect(projectWindow(0).phase).toBe('enter');
    expect(projectWindow(.049).phase).toBe('enter');
    expect(projectWindow(.95).phase).toBe('exit');
    for (let index = 0; index < 6; index++) {
      expect(projectWindow(.05 + index * .15)).toMatchObject({ index, progress: 0, phase: 'project' });
      expect(projectWindow(.05 + (index + .999) * .15).index).toBe(index);
      expect(projectWindow(.05 + (index + .5) * .15).progress).toBeCloseTo(.5);
    }
    expect(projectWindow(1).index).toBe(5);
  });
  it('samples identically directly, forward and reverse at 30 points', () => {
    const points = Array.from({ length: 30 }, (_, i) => ({ ...input, local: i / 29 }));
    const before = structuredClone(points);
    const direct = points.map(point => scene.sample(point));
    expect(points.map(point => scene.sample(point))).toEqual(direct);
    expect([...points].reverse().map(point => scene.sample(point)).reverse()).toEqual(direct);
    expect(points).toEqual(before);
  });
  it('activates only the focused target during a visible project window', () => {
    expect(scene.sample(input).visual.activeTarget).toBeNull();
    for (let i = 0; i < 6; i++) {
      expect(scene.sample({ ...input, local: .05 + (i + .1) * .15 }).visual.activeTarget).toBeNull();
      expect(scene.sample({ ...input, local: .05 + (i + .6) * .15 }).visual.activeTarget).toBe(i);
    }
    expect(scene.sample({ ...input, local: 1 }).visual.activeTarget).toBeNull();
  });
  it('hands the exact camera and rest directive to S06', () => {
    expect(scene.sample({ ...input, local: 1 }).camera).toEqual(s06.sample({ ...input, local: 0 }).camera);
    expect(scene.sample({ ...input, local: 1 }).robot).toEqual({ kind: 'rest' });
  });
  it('keeps the reduced-motion camera and world still throughout the project windows', () => {
    const reduced = { ...input, profile: { ...input.profile, motion: 'reduced' as const } };
    for (let i = 0; i < 6; i++) {
      const camera = scene.sample({ ...reduced, local: .05 + (i + .3) * .15 }).camera;
      const snapshot = scene.sample({ ...reduced, local: .05 + (i + .6) * .15 });
      expect(snapshot.camera).toEqual(camera);
      expect(snapshot.visual.worldProgress).toBe(.5);
      expect(snapshot.robot).toEqual({ kind: 'rest' });
    }
  });
});
describe('gallery content and residency', () => {
  it.each(['ar', 'en'] as const)('maps all six worlds to real %s projects by legacy ID', async locale => {
    const projects = galleryProjects(await getProjects(locale));
    expect(projects.map(project => project.slug)).toEqual(['reef-al-jawf', 'loryfy', 'tasami', 'bena-at', 'al-hemery-for-haj', 'shohnatk']);
    expect(new Set(projects.map(project => project.world)).size).toBe(6);
    expect(projects.every(project => project.screens.length > 0)).toBe(true);
  });
  it('rejects missing and ambiguous content rather than inventing a slug', async () => {
    const projects = await getProjects('en');
    expect(() => galleryProjects([])).toThrow('Missing or ambiguous');
    expect(() => galleryProjects([...projects, projects.find(project => project.oldId === '170')!])).toThrow('Missing or ambiguous');
  });
  it('loads the destination world first and prefetches only its immediate neighbors', async () => {
    for (let index = 0; index < 6; index++) {
      const order: AssetKey[] = [];
      const residency = new AssetResidency(async key => { order.push(key); return { value: key, dispose() {} }; }, 'high');
      const session = acquireDestination(residency, 's05', new AbortController().signal, index);
      await session.ready;
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(order).toEqual(['gallery.shell', 'gallery.portal', 'poster:s05', ...worldKeys(index), ...worldKeys(index, true)]);
      expect(order.filter(key => key.startsWith('world.')).length).toBe(index === 0 || index === 5 ? 2 : 3);
      session.release(); residency.evictUnused();
      expect(worldKeys(index).every(key => !residency.isResident(key))).toBe(true);
    }
  });
});
