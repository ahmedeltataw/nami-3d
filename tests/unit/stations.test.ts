import { describe, expect, it } from 'vitest';
import { Group, Mesh, MeshStandardMaterial, Object3D } from 'three';
import { stations, cameraPoses, bindStation, applyStation } from '../../src/experience/scenes/s03/station';
import { scene, stationProgress } from '../../src/experience/scenes/s03/scene';
import type { SampleInput } from '../../src/experience/contracts';
const input: SampleInput = { local: 0, viewport: { w: 1280, h: 800, dpr: 1 }, profile: { quality: 'high', motion: 'full', renderer: 'webgl' }, interaction: { source: null, token: 0, reaction: null }, seed: 1, ambient: 0 };

describe('creation lab stations', () => {
  it('splits arrival, five equal demo steps, and hold', () => {
    const web = stations[0];
    expect(web.sample(.19, input).phase).toBe('arrival');
    for (let i = 0; i < 5; i++) expect(web.sample(.2 + (i + .5) * .12, input)).toMatchObject({ phase: 'demo', step: i });
    expect(web.sample(.8, input)).toMatchObject({ phase: 'hold', step: 4, robot: { point: 'S1_RobotTarget' } });
    expect(stationProgress(.1)).toEqual({ index: 0, local: 0 });
    expect(stationProgress(1)).toEqual({ index: 5, local: 1 });
  });
  it('samples all stations deterministically and serializably in any order', () => {
    for (const station of stations) {
      const times = Array.from({ length: 20 }, (_, i) => i / 19);
      const direct = times.map(t => station.sample(t, input));
      expect([...times].reverse().map(t => station.sample(t, input)).reverse()).toEqual(direct);
      expect(JSON.parse(JSON.stringify(direct))).toEqual(direct);
      expect(station.sample(0, { ...input, profile: { ...input.profile, motion: 'reduced' } })).toEqual(station.sample(1, input));
    }
    expect(new Set(cameraPoses.map(pose => JSON.stringify(pose.position))).size).toBe(6);
  });
  it('applies offsets to named groups without accumulating on repeated or reversed samples', () => {
    const root = new Object3D(); const card = new Object3D(); card.name = 'S1_CodeCard_1'; card.position.x = 2; root.add(card);
    const bound = bindStation(root); const first = stations[0].sample(.4, input); const last = stations[0].sample(1, input);
    applyStation(first, bound); const original = card.position.toArray();
    applyStation(last, bound); applyStation(first, bound);
    expect(card.position.toArray()).toEqual(original);
  });
  it('restores station one when another station becomes active and pitches arms on X', () => {
    const root = new Object3D(); const card = new Object3D(); const arm = new Object3D();
    card.name = 'S1_CodeCard_1'; arm.name = 'ArmL_Shoulder'; root.add(card, arm);
    const nodes = bindStation(root);
    applyStation(stations[0].sample(.39, input), nodes);
    expect(arm.rotation.x).not.toBe(0);
    expect(arm.rotation.z).toBe(0);
    const other = scene.sample({ ...input, local: .4 });
    applyStation(other.visual.webSnapshot as ReturnType<typeof stations[0]['sample']>, nodes);
    expect(card.visible).toBe(true);
    expect(card.position.x).toBe(0);
    expect(arm.rotation.x).toBeCloseTo(0);
  });
  it('reveals the lab, follows anchors and keeps reduced motion on a fixed overview', () => {
    const reveal = scene.sample({ ...input, local: 0 }).camera;
    expect(reveal.position).not.toEqual(cameraPoses[0].position);
    expect(scene.sample({ ...input, local: .1 }).camera.position).toEqual(cameraPoses[0].position);
    const fixed = scene.sample({ ...input, profile: { ...input.profile, motion: 'reduced' } }).camera;
    for (let i = 1; i < 6; i++) {
      const local = .1 + .9 * (i + .1) / 6;
      const reduced = scene.sample({ ...input, local, profile: { ...input.profile, motion: 'reduced' } });
      expect(reduced.camera).toEqual(fixed);
      const moving = scene.sample({ ...input, local });
      expect(moving.camera.position).not.toEqual(cameraPoses[i].position);
    }
  });
  it('applies scale and zero emissive to any named group', () => {
    const root = new Object3D(); const group = new Group(); group.name = 'Custom'; group.scale.set(2, 3, 4);
    const material = new MeshStandardMaterial({ emissiveIntensity: 2 }); group.add(new Mesh(undefined, material)); root.add(group);
    const nodes = bindStation(root);
    const snapshot = stations[0].sample(1, input);
    snapshot.nodes = { Custom: { visible: true, offset: [0, 0, 0], rotation: [0, 0, 0], scale: [.5, 2, 1], emissive: 0, emissiveColor: [.1, .2, .3] } };
    applyStation(snapshot, nodes);
    expect(group.scale.toArray()).toEqual([1, 6, 4]);
    expect(material.emissiveIntensity).toBe(0);
    expect(material.emissive.toArray()).toEqual([.1, .2, .3]);
    applyStation(snapshot, nodes);
    expect(group.scale.toArray()).toEqual([1, 6, 4]);
  });
});
