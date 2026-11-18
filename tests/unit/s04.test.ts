import { describe, expect, it, vi } from 'vitest';
import { Group, Object3D, Vector3 } from 'three';
import type { SampleInput } from '../../src/experience/contracts';
import { assemblyOrder, assemblyProgress, displayProgress, displayStages, scene, type PhoneCtx } from '../../src/experience/scenes/s04/scene';
import s04Manifest from '../../assets-model/export/s04_idea_v2.manifest.json';

const input: SampleInput = { local: 0, viewport: { w: 1280, h: 800, dpr: 1 }, profile: { quality: 'high', motion: 'full', renderer: 'webgl' }, interaction: { source: null, token: 0, reaction: null }, seed: 1, ambient: 0 };

describe('S04 phone narrative', () => {
  it('assembles frame, back, internals, glass and display in order', () => {
    expect(assemblyOrder).toEqual(['Frame', 'BackPlate', 'Buttons', 'Board', 'Battery', 'Speaker', 'CameraModule', 'Glass', 'Display']);
    for (let order = 1; order <= 8; order++) {
      expect(assemblyProgress(.25, order)).toBe(0);
      expect(assemblyProgress(.6, order)).toBe(1);
      const mid = .25 + .35 * (order - .5) / 8;
      expect(assemblyProgress(mid, order)).toBeCloseTo(.5);
      if (order < 8) expect(assemblyProgress(mid, order + 1)).toBe(0);
    }
  });
  it('maps all seven display stages and crossfades to the final state', () => {
    expect(displayStages).toEqual(['layout', 'nav', 'type', 'components', 'images', 'colors', 'final']);
    for (let i = 0; i < 6; i++) {
      expect(displayProgress(.6 + .3 * (i + .5) / 6)).toEqual({ stage: i, blend: expect.closeTo(.5) });
    }
    expect(displayProgress(.9)).toEqual({ stage: 6, blend: 0 });
  });
  it('samples and applies identically in forward and reverse at 25 points', () => {
    const values = Array.from({ length: 25 }, (_, i) => i / 24);
    const sample = (local: number) => scene.sample({ ...input, local });
    const direct = values.map(sample);
    expect([...values].reverse().map(sample).reverse()).toEqual(direct);
    const node = new Object3D();
    const context: PhoneCtx = { root: new Group(), ambient: 0, reducedMotion: false, parts: [{ node, assembled: new Vector3(1, 2, 3), offset: new Vector3(2, 1, 0), order: 3 }], drawDisplay: vi.fn() };
    const apply = (local: number) => { scene.apply(sample(local), context); return node.position.toArray(); };
    const forward = values.map(apply);
    expect([...values].reverse().map(apply).reverse()).toEqual(forward);
  });
  it('shows the assembled final display without camera travel under reduced motion', () => {
    const profile = { ...input.profile, motion: 'reduced' as const };
    for (const local of [0, .2, .5, .9, 1]) {
      const snapshot = scene.sample({ ...input, profile, local });
      expect(snapshot.visual).toMatchObject({ local: 1, visible: true, displayStage: 6, displayBlend: 0 });
      expect(snapshot.camera.position).toEqual(s04Manifest.camera_hero.position_gltf);
      expect(snapshot.robot).toEqual({ kind: 'pose', name: 'rest' });
    }
  });
});
