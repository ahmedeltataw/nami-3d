import { noJumps } from '../../src/experience/profile';
import { describe, expect, it, vi } from 'vitest';
import { mapScroll, SCENE_IDS, SCROLL_BUDGETS, scrollForScene, TOTAL_BUDGET, sceneFromHash, SCROLL_MAP } from '../../src/experience/controller';
import { scenes } from '../../src/experience/scenes';
import { detectProfile, initialDpr, type ProfileEnvironment } from '../../src/experience/profile';
import { createInteraction } from '../../src/experience/interaction';
import type { SampleInput } from '../../src/experience/contracts';
import { CameraRig } from '../../src/experience/camera/CameraRig';
import { PerspectiveCamera } from 'three';

describe('scroll budgets', () => {
  it.each([640, 900, 1200])('maps every interval and both sides of boundaries at %ipx', height => {
    let start = 0;
    SCENE_IDS.forEach((scene, index) => {
      for (const local of [0, 0.1, 0.5, 0.99]) {
        const y = (start + local * SCROLL_BUDGETS[index]) * height / 100;
        const position = mapScroll(y, height);
        expect(position.scene).toBe(scene);
        expect(position.local).toBeCloseTo(local, 9);
        expect(position.progress).toBeCloseTo((start + local * SCROLL_BUDGETS[index]) / TOTAL_BUDGET, 9);
        expect(scrollForScene(scene, local, height)).toBeCloseTo((SCROLL_MAP[index].hero + local * SCROLL_MAP[index].body) * height / 100, 9);
      }
      const end = (start + SCROLL_BUDGETS[index]) * height / 100;
      const left = mapScroll(end - 0.00001, height);
      const right = mapScroll(end, height);
      expect(left.scene).toBe(scene);
      expect(left.local).toBeCloseTo(1, 6);
      expect(right.scene).toBe(SCENE_IDS[Math.min(index + 1, 6)]);
      expect(right.local).toBeCloseTo(index === 6 ? 1 : 0, 12);
      expect(right.progress - left.progress).toBeLessThan(0.000001);
      start += SCROLL_BUDGETS[index];
    });
    expect(mapScroll(-100, height).local).toBe(0);
    expect(mapScroll(Infinity, height).local).toBe(0);
    expect(mapScroll(1e9, height)).toMatchObject({ scene: 's07', local: 1, b: 1, t: null, progress: 1 });
  });

  it('accepts only scene hashes', () => {
    for (const id of SCENE_IDS) expect(sceneFromHash(`#${id}`)).toBe(id);
    expect(sceneFromHash('#s08')).toBeNull();
    expect(sceneFromHash('#s01?x')).toBeNull();
  });
});

describe('deterministic narrative', () => {
  it.each(SCENE_IDS)('%s has identical direct, forward and reverse samples at 20 points', id => {
    const definition = scenes[id];
    const inputs: SampleInput[] = Array.from({ length: 20 }, (_, i) => ({
      local: i / 19, viewport: { w: 1280, h: 800, dpr: 1.5 },
      profile: { quality: 'high', motion: 'full', renderer: 'webgl' },
      interaction: { source: null, token: 0, reaction: null }, seed: 39, ambient: 4,
    }));
    const before = structuredClone(inputs);
    const direct = inputs.map(input => structuredClone(definition.sample(input)));
    const forward = inputs.map(input => structuredClone(definition.sample(input)));
    const reverse = [...inputs].reverse().map(input => structuredClone(definition.sample(input))).reverse();
    expect(forward).toEqual(direct);
    expect(reverse).toEqual(direct);
    expect(inputs).toEqual(before);
    // Traversal through other scenes must not leave hidden state in a scene definition.
    for (const scene of Object.values(scenes)) for (const input of inputs) scene.sample(input);
    expect(inputs.map(input => definition.sample(input))).toEqual(direct);
  });

  it('snaps every camera property and blends camera intervals', () => {
    const rig = new CameraRig();
    const camera = new PerspectiveCamera();
    const from = { position: [0, 0, 4] as [number, number, number], quaternion: [0, 0, 0, 1] as [number, number, number, number], fov: 40, near: 0.2, far: 80 };
    const to = { ...from, position: [2, 4, 6] as [number, number, number], fov: 60, near: 0.4, far: 120 };
    rig.setPoses(from, to, { blend: 0.5, snap: true });
    rig.apply(camera, 0.001);
    expect(camera.position.toArray()).toEqual([1, 2, 5]);
    expect(camera.fov).toBe(50);
    expect(camera.near).toBeCloseTo(0.3, 12);
    expect(camera.far).toBe(100);
    rig.setPoses(from, to, { blend: 1, snap: true });
    rig.setPoses(from, to, { blend: 1, snap: false });
    rig.apply(camera, 0);
    expect(camera.position.toArray()).toEqual(to.position);
    expect(camera.quaternion.toArray()).toEqual(to.quaternion);
    expect(camera.fov).toBe(60);
  });
});

describe('profile environment', () => {
  const desktop: ProfileEnvironment = { reducedMotion: false, webgl2: true, deviceMemory: 8, hardwareConcurrency: 8, coarsePointer: false };
  it('detects a high desktop and bounded DPR', () => {
    expect(detectProfile(desktop)).toEqual({ quality: 'high', motion: 'full', renderer: 'webgl' });
    expect(initialDpr(false)).toBe(1.5);
    expect(initialDpr(true)).toBe(1);
  });
  it('detects a mid mobile', () => expect(detectProfile({ ...desktop, coarsePointer: true }).quality).toBe('mid'));
  it.each([{ deviceMemory: 2 }, { hardwareConcurrency: 2 }])('detects constrained devices: %o', override => expect(detectProfile({ ...desktop, ...override }).quality).toBe('low'));
  it('uses conservative missing hardware values', () => expect(detectProfile({ ...desktop, hardwareConcurrency: undefined, deviceMemory: undefined }).quality).toBe('mid'));
  it('keeps reduced motion independent of WebGL and quality', () => expect(detectProfile({ ...desktop, reducedMotion: true, webgl2: false })).toEqual({ quality: 'high', motion: 'reduced', renderer: 'fallback' }));
});

describe('interaction arbitration', () => {
  it('honors priorities, cancels prior owners, and ignores stale releases', () => {
    const interaction = createInteraction();
    const cancel = vi.fn();
    const pointer = interaction.request('pointer', cancel)!;
    const drag = interaction.request('drag')!;
    expect(cancel).toHaveBeenCalledOnce();
    expect(interaction.request('scroll')).toBeNull();
    interaction.release(pointer);
    expect(interaction.state.source).toBe('drag');
    interaction.release(drag);
    expect(interaction.state.source).toBeNull();
    interaction.request('director');
    expect(interaction.request('drag')).toBeNull();
  });
  it('caps reactions at 1.2s and cancels on narrative changes', () => {
    const interaction = createInteraction();
    interaction.react('greet', 10, 5);
    expect(interaction.state.reaction?.duration).toBe(1.2);
    interaction.tick(11.21);
    expect(interaction.state.reaction).toBeNull();
    interaction.react('greet', 12, 1);
    interaction.narrativeChanged();
    expect(interaction.state.reaction).toBeNull();
  });
});

it('uses one jump policy for every motion and renderer combination', () => {
  expect(noJumps({ motion: 'full', renderer: 'webgl' })).toBe(false);
  expect(noJumps({ motion: 'reduced', renderer: 'webgl' })).toBe(true);
  expect(noJumps({ motion: 'full', renderer: 'fallback' })).toBe(true);
  expect(noJumps({ motion: 'reduced', renderer: 'fallback' })).toBe(true);
});
