import { loadMessages } from '../../src/i18n/messages';
﻿import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Group, Mesh, MeshStandardMaterial, Object3D } from 'three';
import { stations, cameraPoses, bindStation, applyStation } from '../../src/experience/scenes/s03/station';
import { scene, stationProgress, LAB_INTRO_END, STATION_SPAN } from '../../src/experience/scenes/s03/scene';
import type { SampleInput } from '../../src/experience/contracts';
import enServices from '../../src/content/en/services.json';
import arServices from '../../src/content/ar/services.json';
const arMessages = await loadMessages('ar');
const enMessages = await loadMessages('en');

const input: SampleInput = { local: 0, viewport: { w: 1280, h: 800, dpr: 1 }, profile: { quality: 'high', motion: 'full', renderer: 'webgl' }, interaction: { source: null, token: 0, reaction: null }, seed: 1, ambient: 0 };

describe('creation lab stations', () => {
  it('splits arrival, five equal demo steps, and hold', () => {
    const web = stations[0];
    expect(web.sample(.19, input).phase).toBe('arrival');
    for (let i = 0; i < 5; i++) expect(web.sample(.2 + (i + .5) * .12, input)).toMatchObject({ phase: 'demo', step: i });
    expect(web.sample(.8, input)).toMatchObject({ phase: 'hold', step: 4, robot: { point: 'S1_RobotTarget' } });
    expect(stationProgress(LAB_INTRO_END)).toEqual({ index: 0, local: 0 });
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
    expect(scene.sample({ ...input, local: LAB_INTRO_END }).camera.position).toEqual(cameraPoses[0].position);
    const fixed = scene.sample({ ...input, profile: { ...input.profile, motion: 'reduced' } }).camera;
    for (let i = 1; i < 6; i++) {
      const local = LAB_INTRO_END + STATION_SPAN * (i + .1);
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

  const manifestPath = resolve(__dirname, '../../assets-model/export/stations.manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  const allManifestNodeNames = new Set<string>();
  for (const asset of manifest.assets) {
    for (const node of asset.nodes) {
      allManifestNodeNames.add(node.name);
    }
  }

  it('station 2 mobile conforms to 20/60/20 split, 5 steps, manifest nodes, and arm limits', () => {
    const mobile = stations[1];
    expect(mobile.id).toBe(2);
    expect(mobile.slug).toBe('mobile-application-development');
    expect(mobile.steps).toHaveLength(5);
    expect(mobile.panel.href).toBe('/all-services/2');

    // 20/60/20 split
    expect(mobile.sample(.19, input).phase).toBe('arrival');
    expect(mobile.sample(.19, input).robot.point).toBeNull();

    const activeArmSteps = new Set<number>();
    for (let i = 0; i < 5; i++) {
      const snap = mobile.sample(.2 + (i + .5) * .12, input);
      expect(snap.phase).toBe('demo');
      expect(snap.step).toBe(i);
      expect(snap.robot.point).toBe('S2_RobotTarget');

      // Check if arms move in this step
      for (const [name, node] of Object.entries(snap.nodes)) {
        if (name.startsWith('Arm')) {
          if (node.rotation.some(r => Math.abs(r) > 0.01)) {
            activeArmSteps.add(i);
          }
        }
      }
    }

    // Arms animated in at least 2 steps
    expect(activeArmSteps.size).toBeGreaterThanOrEqual(2);

    const hold = mobile.sample(.8, input);
    expect(hold.phase).toBe('hold');
    expect(hold.step).toBe(4);
    expect(hold.robot.point).toBe('S2_RobotTarget');

    // Determinism & serializable at 20 points
    const times = Array.from({ length: 20 }, (_, i) => i / 19);
    const direct = times.map(t => mobile.sample(t, input));
    expect([...times].reverse().map(t => mobile.sample(t, input)).reverse()).toEqual(direct);
    expect(JSON.parse(JSON.stringify(direct))).toEqual(direct);

    // Node validation against manifest
    expect(Object.keys(hold.nodes).length).toBeGreaterThan(0);
    for (const snap of direct) {
      for (const nodeName of Object.keys(snap.nodes)) {
        expect(allManifestNodeNames.has(nodeName), `Node "${nodeName}" must exist in stations.manifest.json`).toBe(true);
      }
      // Check arm joint limits
      for (const [name, node] of Object.entries(snap.nodes)) {
        if (name === 'ArmL_Shoulder' || name === 'ArmR_Shoulder') {
          // pitch: -60..60 deg = ~1.047 rad
          expect(Math.abs(node.rotation[0])).toBeLessThanOrEqual(1.05);
        }
        if (name === 'ArmL_Elbow' || name === 'ArmR_Elbow') {
          // pitch: -90..60 deg = -1.57..1.05 rad
          expect(node.rotation[0]).toBeGreaterThanOrEqual(-1.58);
          expect(node.rotation[0]).toBeLessThanOrEqual(1.05);
        }
      }
    }
  });

  it('station 3 marketing conforms to 20/60/20 split, 5 steps, manifest nodes, and arm limits', () => {
    const marketing = stations[2];
    expect(marketing.id).toBe(3);
    expect(marketing.slug).toBe('digital-marketing');
    expect(marketing.steps).toHaveLength(5);
    expect(marketing.panel.href).toBe('/all-services/3');

    // 20/60/20 split
    expect(marketing.sample(.19, input).phase).toBe('arrival');
    expect(marketing.sample(.19, input).robot.point).toBeNull();

    const activeArmSteps = new Set<number>();
    for (let i = 0; i < 5; i++) {
      const snap = marketing.sample(.2 + (i + .5) * .12, input);
      expect(snap.phase).toBe('demo');
      expect(snap.step).toBe(i);
      expect(snap.robot.point).toBe('S3_RobotTarget');

      // Check if arms move in this step
      for (const [name, node] of Object.entries(snap.nodes)) {
        if (name.startsWith('Arm')) {
          if (node.rotation.some(r => Math.abs(r) > 0.01)) {
            activeArmSteps.add(i);
          }
        }
      }
    }

    // Arms animated in at least 2 steps
    expect(activeArmSteps.size).toBeGreaterThanOrEqual(2);

    const hold = marketing.sample(.8, input);
    expect(hold.phase).toBe('hold');
    expect(hold.step).toBe(4);
    expect(hold.robot.point).toBe('S3_RobotTarget');

    // Determinism & serializable at 20 points
    const times = Array.from({ length: 20 }, (_, i) => i / 19);
    const direct = times.map(t => marketing.sample(t, input));
    expect([...times].reverse().map(t => marketing.sample(t, input)).reverse()).toEqual(direct);
    expect(JSON.parse(JSON.stringify(direct))).toEqual(direct);

    // Node validation against manifest
    expect(Object.keys(hold.nodes).length).toBeGreaterThan(0);
    for (const snap of direct) {
      for (const nodeName of Object.keys(snap.nodes)) {
        expect(allManifestNodeNames.has(nodeName), `Node "${nodeName}" must exist in stations.manifest.json`).toBe(true);
      }
      // Check arm joint limits
      for (const [name, node] of Object.entries(snap.nodes)) {
        if (name === 'ArmL_Shoulder' || name === 'ArmR_Shoulder') {
          expect(Math.abs(node.rotation[0])).toBeLessThanOrEqual(1.05);
        }
        if (name === 'ArmL_Elbow' || name === 'ArmR_Elbow') {
          expect(node.rotation[0]).toBeGreaterThanOrEqual(-1.58);
          expect(node.rotation[0]).toBeLessThanOrEqual(1.05);
        }
      }
    }
  });

  it('panel text keys exist in ar and en messages with parity and match content', () => {
    const en = enMessages as Record<string, { title?: string; description?: string }>;
    const ar = arMessages as Record<string, { title?: string; description?: string }>;

    for (const station of [stations[1], stations[2]]) {
      const slug = station.slug;
      expect(en[slug], `en.json missing slug ${slug}`).toBeDefined();
      expect(ar[slug], `ar.json missing slug ${slug}`).toBeDefined();
      expect(en[slug].title).toBeTruthy();
      expect(en[slug].description).toBeTruthy();
      expect(ar[slug].title).toBeTruthy();
      expect(ar[slug].description).toBeTruthy();

      const enService = enServices.find(s => s.slug === slug);
      const arService = arServices.find(s => s.slug === slug);
      expect(en[slug].title).toBe(enService?.title);
      expect(en[slug].description).toBe(enService?.description);
      expect(ar[slug].title).toBe(arService?.title);
      expect(ar[slug].description).toBe(arService?.description);
    }
  });

  it('applies station 2 and station 3 node transforms without accumulating', () => {
    const root = new Object3D();
    const phone = new Object3D(); phone.name = 'S2_FloatPhone_1'; root.add(phone);
    const bar = new Object3D(); bar.name = 'S3_Bar_1'; root.add(bar);
    const nodes = bindStation(root);

    const s2Snap = stations[1].sample(.35, input);
    applyStation(s2Snap, nodes);
    expect(phone.position.x).not.toBe(0);

    const s3Snap = stations[2].sample(.35, input);
    applyStation(s3Snap, nodes);
    expect(bar.scale.y).toBeGreaterThan(0);
  });
});
