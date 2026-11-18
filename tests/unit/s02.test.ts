import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { SampleInput } from '../../src/experience/contracts';
import { backgroundColor, scene, type S02Visual } from '../../src/experience/scenes/s02/scene';
import { scene as lab } from '../../src/experience/scenes/s03/scene';
import { bindPortal, type PortalState } from '../../src/experience/shared/portal/Portal';
import { ringAngles, segmentDistance } from '../../src/experience/shared/portal/motion';
import { previewVisible } from '../../src/experience/scenes/s02';
import s02Manifest from '../../assets-model/export/s02_portal_v2.manifest.json';

const input: SampleInput = { local: 0, viewport: { w: 1280, h: 800, dpr: 1.5 },
  profile: { quality: 'high', motion: 'full', renderer: 'webgl' },
  interaction: { source: null, token: 0, reaction: null }, seed: 1, ambient: 0 };
const points = Array.from({ length: 25 }, (_, i) => i / 24);
const sample = (local: number) => scene.sample({ ...input, local });
const visual = (local: number) => sample(local).visual as S02Visual;

describe('S02 deterministic choreography', () => {
  it('matches direct, forward and reverse sampling at 25 points, independent of ambient time', () => {
    const direct = points.map(sample);
    expect(points.map(sample)).toEqual(direct);
    expect([...points].reverse().map(sample).reverse()).toEqual(direct);
    expect(points.map(local => scene.sample({ ...input, local, ambient: 999, introSeconds: 2 }))).toEqual(direct);
  });
  it('transitions white to exact charcoal over the first .4', () => {
    expect(backgroundColor(0)).toEqual([1, 1, 1]);
    expect(backgroundColor(.4)).toEqual([27 / 255, 29 / 255, 32 / 255]);
    expect(backgroundColor(1)).toEqual(backgroundColor(.4));
    expect(backgroundColor(.2)[0]).toBeCloseTo((1 + 27 / 255) / 2);
  });
  it('samples charge, sphere, opening and flight as composer directives', () => {
    expect(sample(0).robot).toMatchObject({ name: 'ChargeEnergy', timeSeconds: 0, weight: 1 });
    expect(sample(.2).robot).toMatchObject({ name: 'ChargeEnergy', timeSeconds: 1.4 });
    expect(visual(.2).sphere).toBe(0);
    expect(visual(.35).sphere).toBe(1);
    expect(sample(.35).robot).toMatchObject({ name: 'OpenPortal', timeSeconds: 0 });
    expect(visual(.5)).toMatchObject({ assembleProgress: 1, morph: 1 });
    expect(sample(.75).robot).toMatchObject({ name: 'Fly', timeSeconds: 0 });
    expect(visual(.7).robotPosition[0]).toBeLessThan(-1);
    expect(visual(.96).brightness).toBe(1);
    expect(visual(1).brightness).toBe(0);
  });
  it('stagger endpoints are exact and later segments arrive later', () => {
    for (let i = 0; i < 10; i++) {
      expect(segmentDistance(0, i)).toBe(2.6);
      expect(segmentDistance(1, i)).toBe(0);
    }
    expect(segmentDistance(.3, 0)).toBeLessThan(segmentDistance(.3, 9));
  });
  it('spins clockwise/anticlockwise without accumulating history and accelerates', () => {
    expect(ringAngles(2, 3)).toEqual({ outer: -6, inner: 8.100000000000001 });
    expect(visual(.56).outerAngle).toBeLessThan(0);
    expect(visual(.56).innerAngle).toBeGreaterThan(0);
    expect(visual(.61).ringSpeed).toBeGreaterThan(visual(.55).ringSpeed);
    expect(visual(.74).outerAngle).toBeLessThan(visual(.63).outerAngle);
  });
  it('pushes through z=-2 and matches FOV beats before the S03 handoff', () => {
    expect(sample(0).camera).toMatchObject({ position: s02Manifest.camera_hero.position_gltf, fov: s02Manifest.camera_hero.vertical_fov_deg });
    expect(sample(.75).camera.fov).toBe(s02Manifest.camera_hero.vertical_fov_deg);
    expect(sample(.835).camera.fov).toBe(66);
    expect(sample(.92).camera.fov).toBe(64);
    expect(sample(.92).camera.position[2]).toBeLessThan(-2);
    expect(sample(1).camera).toEqual(sample(.92).camera);
    expect(sample(1).camera).not.toEqual(lab.sample(input).camera);
    expect(visual(1).reveal).toBe(0);
  });
  it('uses discrete reduced motion states, no push or spin, and a short dissolve', () => {
    const profile = { ...input.profile, motion: 'reduced' as const };
    const samples = points.map(local => scene.sample({ ...input, local, profile }));
    expect([...points].reverse().map(local => scene.sample({ ...input, local, profile })).reverse()).toEqual(samples);
    for (const local of [0, .3, .75, .91]) {
      const snapshot = scene.sample({ ...input, local, profile });
      expect(snapshot.camera.position).toEqual(s02Manifest.camera_hero.position_gltf);
      expect(snapshot.robot).toEqual({ kind: 'pose', name: 'rest' });
      expect(snapshot.visual).toMatchObject({ sphere: 0, ringSpeed: 0, surfaceTime: 0 });
    }
    expect(scene.sample({ ...input, local: .94, profile }).visual.brightness).toBe(1);
    expect(scene.sample({ ...input, local: 1, profile }).camera).toEqual(scene.sample({ ...input, local: 0, profile }).camera);
  });
  it('limits preview rendering to the visible portal and chooses mobile target size', () => {
    expect(previewVisible(0, 0)).toBe(false);
    expect(previewVisible(.5, 0)).toBe(true);
    expect(previewVisible(1, .01)).toBe(false);
    expect(previewVisible(1, 0, -2)).toBe(false);
    expect(previewVisible(1, 0, -3)).toBe(false);
    expect(visual(.7).previewSize).toBe(512);
    expect(scene.sample({ ...input, viewport: { w: 390, h: 844, dpr: 1 } }).visual.previewSize).toBe(256);
  });
});

it('assembles the real portal along its extras radial directions and restores the same pose on reverse seek', async () => {
  const bytes = readFileSync('public/models/portal/portal_gate.glb');
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const portal = bindPortal(gltf.scene);
  const state: PortalState = { assembleProgress: 0, ringSpeed: 1, openAmount: 1, surfaceTexture: null, time: 2 };
  expect(portal.segments).toHaveLength(20);
  portal.update(state);
  for (const part of portal.segments) {
    expect(part.node.position.x - part.x).toBeCloseTo(part.radialX * 2.6);
    expect(part.node.position.y - part.y).toBeCloseTo(part.radialY * 2.6);
  }
  const capture = () => portal.segments.map(part => part.node.position.toArray());
  state.assembleProgress = .47; portal.update(state); const direct = capture();
  state.assembleProgress = 1; portal.update(state);
  for (const part of portal.segments) expect(part.node.position.toArray()).toEqual([part.x, part.y, part.z]);
  state.assembleProgress = .47; portal.update(state); expect(capture()).toEqual(direct);
  expect(portal.outer!.rotation.z).toBe(-2); expect(portal.inner!.rotation.z).toBe(2.7);
  state.reduced = true; portal.update(state);
  expect(portal.outer!.rotation.z).toBe(-0); expect(portal.inner!.rotation.z).toBe(0);
  expect(portal.material.uniforms.uTime.value).toBe(0);
  portal.dispose();
});

it('verifies s02_portal_v2.glb exposes all manifest portal, tunnel, lab_view and fx_static nodes', async () => {
  const source = readFileSync(`public/models/s02/${s02Manifest.file}`);
  const jsonLength = source.readUInt32LE(12);
  const json = JSON.parse(source.subarray(20, 20 + jsonLength).toString('utf8'));
  delete json.materials;
  delete json.textures;
  delete json.images;
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) delete primitive.material;
  }
  const serialized = JSON.stringify(json);
  const chunk = Buffer.from(serialized + ' '.repeat((4 - Buffer.byteLength(serialized) % 4) % 4));
  const binary = source.subarray(20 + jsonLength);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(20 + chunk.length + binary.length, 8);
  header.writeUInt32LE(chunk.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const bytes = Buffer.concat([header, chunk, binary]);
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  for (const name of [
    s02Manifest.portal.root,
    ...s02Manifest.portal.nodes,
    ...s02Manifest.portal.tunnel,
    s02Manifest.portal.lab_view,
    ...s02Manifest.fx_static,
  ]) {
    expect(gltf.scene.getObjectByName(name), `Missing ${name} in ${s02Manifest.file}`).toBeDefined();
  }
});
