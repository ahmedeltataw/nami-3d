import { describe, expect, it } from 'vitest';
import { AnimationClip, Group, Object3D, QuaternionKeyframeTrack, Vector3 } from 'three';
import { scene } from '../../src/experience/scenes/s01/scene';
import { createIntroClock } from '../../src/experience/robot/intro';
import { createHeadReaction, pointerNearHead } from '../../src/experience/robot/procedural';
import { RobotComposer, type PoseLayers } from '../../src/experience/robot/compose';
import type { SampleInput } from '../../src/experience/contracts';

const input: SampleInput = {
  local: 0, viewport: { w: 1280, h: 800, dpr: 1.5 },
  profile: { quality: 'high', motion: 'full', renderer: 'webgl' },
  interaction: { source: null, token: 0, reaction: null }, seed: 1, ambient: 0,
};
const points = Array.from({ length: 25 }, (_, i) => i / 24);

describe('S01 narrative sampling', () => {
  it('is identical at 25 points directly, forward, reverse and after cancelling any intro beat', () => {
    const direct = points.map(local => scene.sample({ ...input, local }));
    const forward = points.map(local => scene.sample({ ...input, local }));
    const reverse = [...points].reverse().map(local => scene.sample({ ...input, local })).reverse();
    expect(forward).toEqual(direct);
    expect(reverse).toEqual(direct);
    for (const seconds of [-0.1, 0.5, 1.5, 2.5, 4]) {
      const clock = createIntroClock();
      clock.sample(0);
      scene.sample({ ...input, introSeconds: clock.sample(seconds + 0.15) });
      clock.cancel();
      const cancelled = points.map(local => scene.sample({ ...input, local, introSeconds: clock.sample(7) }));
      expect(cancelled).toEqual(direct);
    }
  });

  it('holds the end pose through .35, adds the hint, then dollies and focuses', () => {
    const end = scene.sample(input);
    expect(scene.sample({ ...input, local: 0.35 })).toEqual(end);
    const middle = scene.sample({ ...input, local: 0.55 });
    expect(middle.visual.subtitleEmphasis).toBe(1);
    expect(middle.camera.position[2]).toBe(4.2);
    const final = scene.sample({ ...input, local: 1 });
    expect(final.camera.position[2]).toBeCloseTo(2.6);
    expect(final.camera.fov).toBe(35);
    expect(final.visual).toMatchObject({ robotX: -0.55, focus: 1, headlineExit: 1 });
    expect(final.robot).toMatchObject({ name: 'ChargeEnergy', timeSeconds: 0 });
  });

  it('skip is immediate and the intro never restarts after completion or cancellation', () => {
    const clock = createIntroClock();
    expect(clock.sample(0)).toBeLessThan(0);
    expect(clock.sample(1)).toBeCloseTo(0.85);
    clock.cancel();
    expect(scene.sample({ ...input, introSeconds: clock.sample(1) })).toEqual(scene.sample(input));
    expect(clock.sample(0)).toBeUndefined();
    const completed = createIntroClock();
    completed.sample(0);
    expect(completed.sample(5)).toBeUndefined();
    expect(completed.sample(0)).toBeUndefined();
  });

  it('reduced motion immediately shows the end state and only changes the camera at a discrete endpoint', () => {
    const clock = createIntroClock();
    expect(clock.sample(0, true)).toBeUndefined();
    const profile = { ...input.profile, motion: 'reduced' as const };
    const end = scene.sample({ ...input, profile });
    for (const introSeconds of [-1, 0, 1, 3, 4.5]) {
      expect(scene.sample({ ...input, profile, introSeconds })).toEqual(end);
    }
    for (const local of points.slice(0, -1)) {
      expect(scene.sample({ ...input, profile, local }).camera).toEqual(end.camera);
    }
    expect(scene.sample({ ...input, profile, local: 1 }).camera.position[2]).toBeCloseTo(2.6);
  });
});

describe('S01 interaction and composition', () => {
  it('only accepts clicks at least 3 seconds apart', () => {
    const react = createHeadReaction();
    expect(react(0)).toBe(true);
    expect(react(0.5)).toBe(false);
    expect(react(2.999)).toBe(false);
    expect(react(3)).toBe(true);
    expect(react(5.99)).toBe(false);
    expect(react(6)).toBe(true);
  });

  it('detects the projected head boundary and ignores hidden or invalid regions', () => {
    const head = { x: 600, y: 300, radius: 60, visible: true };
    expect(pointerNearHead(600, 300, head)).toBe(true);
    expect(pointerNearHead(660, 300, head)).toBe(true);
    expect(pointerNearHead(661, 300, head)).toBe(false);
    expect(pointerNearHead(600, 300, { ...head, visible: false })).toBe(false);
    expect(pointerNearHead(600, 300, { ...head, radius: 0 })).toBe(false);
  });

  it('falls back to Idle when batch B clips are absent and composes eye/tilt layers without accumulating', () => {
    const object = new Group();
    for (const name of ['Head', 'Eye_L', 'Eye_R']) { const node = new Object3D(); node.name = name; object.add(node); }
    const idle = new AnimationClip('Idle', 1, [new QuaternionKeyframeTrack('Head.quaternion', [0, 1], [0, 0, 0, 1, 0, 0, 0, 1])]);
    const composer = new RobotComposer();
    composer.bind(object, [idle]);
    const layers: PoseLayers = { time: 0, delta: 0, reduced: false, canLook: true, target: new Vector3(0, 0, 1), reaction: null, headNear: true, eyeOpen: 0.5 };
    for (const name of ['LookAround', 'Draw', 'ChargeEnergy'] as const) {
      composer.compose({ kind: 'clip', name, timeSeconds: 0, weight: 1 }, layers);
      expect(object.getObjectByName('Head')!.rotation.z).toBeCloseTo(8 * Math.PI / 180);
      expect(object.getObjectByName('Eye_L')!.scale.y).toBe(0.5);
    }
    layers.reaction = { name: 'React', startedAt: 0, duration: 0.5, priority: 1 };
    layers.time = 0.25;
    composer.compose({ kind: 'clip', name: 'Idle', timeSeconds: 0, weight: 1 }, layers);
    expect(Math.abs(object.getObjectByName('Head')!.rotation.x)).toBeGreaterThan(0.1);
    layers.time = 0.5;
    composer.compose({ kind: 'clip', name: 'Idle', timeSeconds: 0, weight: 1 }, layers);
    expect(object.getObjectByName('Head')!.rotation.x).toBeCloseTo(0);
    composer.dispose();
  });
});
