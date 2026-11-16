import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Quaternion, Vector3, type QuaternionKeyframeTrack } from 'three';
import { RobotComposer, type PoseLayers } from '../../src/experience/robot/compose';
import { RobotFSM } from '../../src/experience/robot/fsm';
import { EYE_LIMIT, floatRoll, floatY, HEAD_PITCH, HEAD_YAW, lookAt } from '../../src/experience/robot/procedural';
import { scene as s01 } from '../../src/experience/scenes/s01/scene';
import type { SampleInput, SceneSnapshot } from '../../src/experience/contracts';
import { robotAssetKey } from '../../src/experience/assets/manifest';

// Keep the shipped animation/geometry buffers; omit only materials so Node needs no image decoder.
async function loadRig(lod: 'high' | 'low') {
  const source = readFileSync(`public/models/robot/robot_${lod}.glb`);
  const jsonLength = source.readUInt32LE(12);
  const json = JSON.parse(source.subarray(20, 20 + jsonLength).toString());
  delete json.materials; delete json.textures; delete json.images;
  for (const mesh of json.meshes) for (const primitive of mesh.primitives) delete primitive.material;
  const serialized = JSON.stringify(json);
  const chunk = Buffer.from(serialized + ' '.repeat((4 - Buffer.byteLength(serialized) % 4) % 4));
  const binary = source.subarray(20 + jsonLength);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + chunk.length + binary.length, 8);
  header.writeUInt32LE(chunk.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  const glb = Buffer.concat([header, chunk, binary]);
  return new GLTFLoader().parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), '');
}

const input: SampleInput = {
  local: 0, viewport: { w: 1280, h: 800, dpr: 1.5 },
  profile: { quality: 'high', motion: 'full', renderer: 'webgl' },
  interaction: { source: null, token: 0, reaction: null }, seed: 1, ambient: 0,
};
function layers(overrides: Partial<PoseLayers> = {}): PoseLayers {
  return { time: 0, delta: 1 / 60, reduced: false, canLook: false, target: null, reaction: null, ...overrides };
}
function pose(composer: RobotComposer) {
  const result: Record<string, number[]> = {};
  composer.object!.traverse(node => { result[node.name] = [...node.position.toArray(), ...node.quaternion.toArray(), ...node.scale.toArray()]; });
  return result;
}

describe('robot runtime with shipped GLB tracks', () => {
  let high: GLTF;
  let low: GLTF;
  beforeAll(async () => { [high, low] = await Promise.all([loadRig('high'), loadRig('low')]); });

  it.each(['Sleep', 'WakeUp', 'Wave', 'Idle'] as const)('samples %s at explicit times, including reverse and exact endpoint', name => {
    const composer = new RobotComposer();
    composer.bind(high.scene.clone(true), high.animations);
    const clip = high.animations.find(clip => clip.name === name)!;
    const track = clip.tracks.find(track => track.name === 'Head.quaternion') as QuaternionKeyframeTrack;
    const expected = new Float32Array(4);
    const interpolant = (track as unknown as { createInterpolant(result: Float32Array): { evaluate(t: number): Float32Array } }).createInterpolant(expected);
    for (const seconds of [0, clip.duration * 0.5, clip.duration, clip.duration * 0.2, 0]) {
      composer.compose({ kind: 'clip', name, timeSeconds: seconds, weight: 1 }, layers());
      const sampleTime = name === 'Idle' || name === 'Sleep' ? seconds % clip.duration : seconds;
      interpolant.evaluate(sampleTime);
      const actual = composer.object!.getObjectByName('Head')!.quaternion;
      expect(actual.angleTo(new Quaternion().fromArray(expected))).toBeLessThan(0.001);
    }
    composer.dispose();
  });

  it('blends clip weight against rest and clears untracked joints on directive changes', () => {
    const composer = new RobotComposer();
    composer.bind(high.scene.clone(true), high.animations);
    const rest = composer.object!.getObjectByName('Shoulder_R')!.quaternion.clone();
    composer.compose({ kind: 'clip', name: 'Wave', timeSeconds: 0.8, weight: 1 }, layers());
    const full = composer.object!.getObjectByName('Shoulder_R')!.quaternion.clone();
    expect(full.angleTo(rest)).toBeGreaterThan(0.1);
    composer.compose({ kind: 'clip', name: 'Wave', timeSeconds: 0.8, weight: 0.5 }, layers());
    expect(composer.object!.getObjectByName('Shoulder_R')!.quaternion.angleTo(rest.clone().slerp(full, 0.5))).toBeLessThan(0.001);
    composer.compose({ kind: 'clip', name: 'Idle', timeSeconds: 0, weight: 1 }, layers());
    expect(composer.object!.getObjectByName('Shoulder_R')!.quaternion.angleTo(rest)).toBeLessThan(0.001);
    composer.dispose();
  });

  it('seek is identical directly, forwards and backwards over 25 S01 locals', () => {
    const samples = Array.from({ length: 25 }, (_, i) => s01.sample({ ...input, local: i / 24 }));
    function traverse(order: SceneSnapshot[]) {
      const composer = new RobotComposer();
      const fsm = new RobotFSM();
      composer.bind(high.scene.clone(true), high.animations);
      const output = order.map(snapshot => {
        fsm.seek(snapshot); composer.resetGaze();
        composer.compose(snapshot.robot, layers({ time: 7, canLook: fsm.canLook }));
        return { state: fsm.state, pose: pose(composer) };
      });
      composer.dispose();
      return output;
    }
    const direct = samples.map(sample => traverse([sample])[0]);
    expect(traverse(samples)).toEqual(direct);
    expect(traverse([...samples].reverse()).reverse()).toEqual(direct);
  });

  it('samples S01 intro beats without hidden state and reduced motion returns rest', () => {
    const expected = [[-1, 'Sleep', 0], [0, 'WakeUp', 0], [0.6, 'WakeUp', 0.6], [1.2, 'LookAround', 0.2], [1.8, 'Wave', 0], [2.6, 'Wave', 0.8], [3.4, 'Draw', 0], [4.6, 'Idle', 0]] as const;
    for (const [introSeconds, name, seconds] of [...expected].reverse()) {
      const directive = s01.sample({ ...input, introSeconds }).robot;
      expect(directive).toMatchObject({ kind: 'clip', name });
      if (directive.kind === 'clip') expect(directive.timeSeconds).toBeCloseTo(seconds);
    }
    expect(s01.sample({ ...input, local: 0.1, introSeconds: 0.4 }).robot).toEqual({ kind: 'clip', name: 'Idle', timeSeconds: 0, weight: 1 });
    expect(s01.sample({ ...input, introSeconds: 0.4, profile: { ...input.profile, motion: 'reduced' } }).robot).toEqual({ kind: 'pose', name: 'rest' });
  });

  it('reduced motion yields imported rest even during a clip, gaze and reaction', () => {
    const composer = new RobotComposer();
    composer.bind(high.scene.clone(true), high.animations);
    const rest = pose(composer);
    composer.compose({ kind: 'clip', name: 'Wave', timeSeconds: 0.8, weight: 1 }, layers({ time: 0.5, reduced: true, canLook: true, target: new Vector3(5, 4, 2), reaction: { name: 'nod', startedAt: 0, duration: 1, priority: 1 } }));
    expect(pose(composer)).toEqual(rest);
    composer.dispose();
  });

  it('S01 wake layers set the requested pitch and eye opening over the native clip channels', () => {
    const composer = new RobotComposer();
    composer.bind(high.scene.clone(true), high.animations);
    for (const introSeconds of [0, 0.3, 0.6, 1, 1.19]) {
      const snapshot = s01.sample({ ...input, introSeconds });
      composer.compose(snapshot.robot, layers({ headPitch: Number(snapshot.visual.headPitch), eyeOpen: Number(snapshot.visual.eyeOpen) }));
      expect(composer.object!.getObjectByName('Head')!.rotation.x).toBeCloseTo((1 - introSeconds / 1.2) * -8 * Math.PI / 180);
      expect(composer.object!.getObjectByName('Eye_L')!.scale.y).toBeCloseTo(introSeconds / 1.2);
    }
    composer.dispose();
  });

  it.each(['low', 'high'] as const)('carries all joint transforms on a LOD swap to %s', lod => {
    const composer = new RobotComposer();
    composer.bind(high.scene.clone(true), high.animations);
    const directive = { kind: 'clip', name: 'Wave', timeSeconds: 0.9, weight: 1 } as const;
    const options = layers({ time: 0.5, canLook: true, target: new Vector3(2, 3, 4), reaction: { name: 'tilt', startedAt: 0, duration: 1, priority: 1 } });
    composer.compose(directive, options);
    const before = pose(composer);
    const next = lod === 'low' ? low : high;
    composer.bind(next.scene.clone(true), next.animations);
    expect(pose(composer)).toEqual(before);
    options.delta = 0;
    composer.compose(directive, options);
    const after = pose(composer);
    for (const name of Object.keys(before)) after[name].forEach((value, i) => expect(value).toBeCloseTo(before[name][i], 5));
    expect(composer.object!.getObjectByName('RightHand_Anchor')).toBeDefined();
    composer.dispose();
    expect(robotAssetKey('mid')).toBe('robot.low');
    expect(robotAssetKey('high')).toBe('robot.high');
  });
});

describe('robot overlays and procedural limits', () => {
  it('cancels on narrative change, honors priority, expires, seeks and resets', () => {
    const fsm = new RobotFSM();
    const snapshot = s01.sample(input);
    fsm.seek(snapshot);
    fsm.send({ type: 'reaction', name: 'nod', now: 0, duration: 5, priority: 3 });
    expect(fsm.reaction?.duration).toBe(1.2);
    fsm.send({ type: 'reaction', name: 'tilt', now: 0.1, duration: 1, priority: 1 });
    expect(fsm.reaction?.name).toBe('nod');
    fsm.tick(1.2); expect(fsm.reaction).toBeNull();
    fsm.send({ type: 'reaction', name: 'nod', now: 2, duration: 1 });
    fsm.observe(s01.sample({ ...input, local: 0.2 })); expect(fsm.reaction).toBeNull();
    fsm.send({ type: 'reaction', name: 'nod', now: 3, duration: 1 });
    fsm.setState('performing'); expect(fsm.reaction).toBeNull();
    fsm.seek(snapshot); expect(fsm.reaction).toBeNull();
    fsm.send({ type: 'cancel' });
    fsm.send({ type: 'reset' }); expect(fsm.state).toBe('sleep');
    fsm.seek(s01.sample({ ...input, introSeconds: 0.5 })); expect(fsm.state).toBe('waking');
    fsm.send({ type: 'reaction', name: 'nod', now: 4, duration: 1 }); expect(fsm.reaction).toBeNull();
  });

  it('clamps head and eyes and damps at lambda 6 without mutating input', () => {
    const zero = { yaw: 0, pitch: 0, eyeYaw: 0, eyePitch: 0 };
    const out = { ...zero };
    for (const x of [-100, 100]) for (const y of [-100, 100]) {
      lookAt(x, y, 0.1, zero, 10, out);
      expect(Math.abs(out.yaw)).toBeLessThanOrEqual(HEAD_YAW);
      expect(Math.abs(out.pitch)).toBeLessThanOrEqual(HEAD_PITCH);
      expect(Math.abs(out.eyeYaw)).toBeLessThanOrEqual(EYE_LIMIT);
      expect(Math.abs(out.eyePitch)).toBeLessThanOrEqual(EYE_LIMIT);
    }
    lookAt(100, 0, 1, zero, 0.1, out);
    expect(out.yaw).toBeCloseTo(HEAD_YAW * (1 - Math.exp(-0.6)), 10);
    expect(zero).toEqual({ yaw: 0, pitch: 0, eyeYaw: 0, eyePitch: 0 });
    lookAt(100, 100, 1, out, 1, out, true); expect(out).toEqual(zero);
    expect(floatY(2)).toBeCloseTo(0.04 * Math.sin(1.8));
    expect(floatRoll(2)).toBeCloseTo(0.6 * Math.PI / 180 * Math.sin(1.4));
    expect(floatY(2, true)).toBe(0); expect(floatRoll(2, true)).toBe(0);
  });
});
