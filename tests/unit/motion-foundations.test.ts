import { ambientAngle } from '../../src/experience/ambient';
import { nodeState, writeMotion } from '../../src/experience/scenes/s05/worlds/motion';
import { describe, expect, it } from 'vitest';
import { captureTimes, createMotionClock } from '../../src/experience/clocks';
import { bodyProgress, createScrollMap, localForBody, mapScroll, mapUnits, SCROLL_MAP, scrollForScene, TOTAL_BUDGET, unitsForScene } from '../../src/experience/scroll-map';
import { ambientWeight, beatsFor, DEFAULT_JUMP_BEATS, jumpOwnership, readinessPresentation, resolveBeats } from '../../src/experience/transitions/beats';
import { transitions, transitionAt } from '../../src/experience/transitions';
import { createRuntime, evaluateRuntime } from '../../src/experience/runtime';
import { directorDuration, DIRECTOR_VH_PER_SECOND } from '../../src/experience/director';
import { stationSeekLocal } from '../../src/experience/scenes/s03/scene';
import { projectSeekLocal } from '../../src/experience/scenes/s05/scene';
import { AnimationClip, BoxGeometry, Group, Mesh, MeshBasicMaterial, PointLight, VectorKeyframeTrack } from 'three';
import { RobotComposer } from '../../src/experience/robot/compose';
import { ScenePresentation, TransportChannels } from '../../src/experience/presentation';

describe('single scroll table', () => {
  it('partitions every unchanged budget into tail, body and head', () => {
    for (const [index, row] of SCROLL_MAP.entries()) {
      expect(row.tail + row.body + row.head).toBe(row.budget);
      expect(mapUnits(row.hero)).toMatchObject({ scene: row.id, b: 0, t: null });
      expect(mapUnits(row.hero + row.body / 2)).toMatchObject({ scene: row.id, phase: 'body', b: .5, t: null });
      if (row.head) {
        const next = SCROLL_MAP[index + 1];
        expect(row.head + next.tail).toBe(110);
        expect(mapUnits(row.departure + 27.5)).toMatchObject({ scene: row.id, b: 1, phase: 'head', t: .25 });
        expect(mapUnits(next.start + 27.5)).toMatchObject({ scene: next.id, b: 0, phase: 'tail', t: .75 });
      }
      for (const b of [0, .2, .5, .99]) {
        expect(bodyProgress(row.id, localForBody(row.id, b))).toBeCloseTo(b);
        expect(mapScroll(scrollForScene(row.id, b, 900), 900).b).toBeCloseTo(b);
      }
    }
    expect(SCROLL_MAP.reduce((sum, row) => sum + row.budget, 0)).toBe(TOTAL_BUDGET);
  });
  it('derives nav/hash hero, Director duration, station and project seek positions', () => {
    for (const [index, row] of SCROLL_MAP.entries()) {
      expect(scrollForScene(row.id, 0, 100)).toBe(row.hero);
      expect(transitionAt(row.id, localForBody(row.id, 0))).toBeNull();
      if (index < 6) expect(directorDuration(row.id)).toBe((SCROLL_MAP[index + 1].hero - row.hero) / DIRECTOR_VH_PER_SECOND * 1000);
    }
    expect(directorDuration('s07')).toBe(SCROLL_MAP[6].body / DIRECTOR_VH_PER_SECOND * 1000);
    expect(directorDuration('s07')).toBeGreaterThan(1000);
    for (let n = 1; n <= 6; n++) {
      expect(mapUnits(unitsForScene('s03', stationSeekLocal(n))).b).toBeCloseTo(stationSeekLocal(n));
      expect(mapUnits(unitsForScene('s05', projectSeekLocal(n - 1))).b).toBeCloseTo(projectSeekLocal(n - 1));
    }
    const custom = createScrollMap(Array.from({ length: 6 }, () => ({ head: 50, tail: 60 })));
    expect(custom[1]).toMatchObject({ tail: 60, body: 130, head: 50, hero: 240 });
  });
});

describe('opaque ownership seams', () => {
  it.each(Object.keys(transitions) as (keyof typeof transitions)[])('%s switches the whole ownership bundle under an opaque wash', id => {
    const beats = beatsFor(id);
    const def = transitions[id];
    const midpoint = (beats.opaque[0] + beats.opaque[1]) / 2;
    for (const t of [beats.opaque[0] - 1e-7, midpoint - 1e-7, midpoint, midpoint + 1e-7, beats.opaque[1] + 1e-7]) {
      const runtime = createRuntime();
      runtime.profile.motion = 'full'; runtime.intro.cancel();
      const row = SCROLL_MAP.find(row => row.id === def.from)!;
      const mapped = mapUnits(row.departure + t * 110);
      Object.assign(runtime, mapped, { narrativeLocal: mapped.local, local: mapped.b });
      evaluateRuntime(runtime);
      const snap = runtime.transition!;
      expect(snap.owner).toBe(t < midpoint ? def.from : def.to);
      expect(snap.owner).toBe(jumpOwnership(def.from, def.to, t, beats).owner);
      const lens = runtime.sceneSnapshots[snap.owner]!.camera;
      expect(snap.camera.from.fov).toBe(lens.fov);
      expect(snap.camera.to.fov).toBe(lens.fov);
      expect(snap.lights.aWeight).toBe(Number(snap.owner === def.from));
      expect(snap.lights.bWeight).toBe(Number(snap.owner === def.to));
      expect(snap.fromVisibility + snap.toVisibility).toBeCloseTo(1);
      if (t >= beats.opaque[0] && t <= beats.opaque[1]) expect(snap.wash).toBe(1);
    }
  });
  it('keeps the long-gate timing override explicit', () => {
    expect(beatsFor('s02->s03')).toMatchObject({ opaque: [.55, .60], dissolve: [.34, .40] });
  });
});

describe('explicit clocks and deterministic sampling', () => {
  it('clamps hidden-tab steps and freezes ambient and intro in reduced motion', () => {
    const clock = createMotionClock();
    expect(clock.tick(20, false, true)).toEqual({ ambientTime: .1, introTime: .1 });
    clock.tick(20, true, true);
    expect(clock.value).toEqual({ ambientTime: .1, introTime: .1 });
    clock.setCapture({ ambientTime: 9, introTime: 2 });
    expect(clock.tick(50, false, true)).toEqual({ ambientTime: 9, introTime: 2 });
    expect(captureTimes('?capture=1&ambient=4.2&intro=1.4')).toEqual({ ambientTime: 4.2, introTime: 1.4, introExplicit: true });
    expect(captureTimes('?ambient=4')).toBeNull();
  });
  it('returns the same full snapshot after any traversal for progress + ambient + intro', () => {
    const runtime = createRuntime(); runtime.viewport = { w: 1280, h: 800, dpr: 1 };
    runtime.clocks.setCapture({ ambientTime: 12, introTime: 2.5 });
    const sample = (units: number) => {
      const mapped = mapUnits(units);
      Object.assign(runtime, mapped, { narrativeLocal: mapped.local, local: mapped.b });
      evaluateRuntime(runtime);
      return JSON.stringify({ snapshot: runtime.snapshot, transition: runtime.transition, scenes: runtime.sceneSnapshots });
    };
    const points = [0, ...SCROLL_MAP.flatMap(row => [row.hero, row.hero + row.body * .5, row.departure + (row.head ? 40 : 0)])];
    const expected = points.map(sample);
    expect(points.toReversed().map(sample).toReversed()).toEqual(expected);
    expect(points.map(sample)).toEqual(expected);
  });
  it('canonicalizes the entire reduced-motion path to each hero without a jump', () => {
    const runtime = createRuntime(); runtime.profile.motion = 'reduced';
    runtime.clocks.setCapture({ ambientTime: 15, introTime: 1 });
    for (const row of SCROLL_MAP) {
      runtime.scene = row.id; runtime.b = .9; runtime.narrativeLocal = .99;
      evaluateRuntime(runtime);
      const snapshot = runtime.snapshot;
      runtime.b = .1; runtime.narrativeLocal = .01; evaluateRuntime(runtime);
      expect(runtime.snapshot).toEqual(snapshot);
      expect(runtime.transition).toBeNull(); expect(runtime.ambientWeight).toBe(0);
    }
  });
  it('blends ambient amplitude to canonical during charge and back during landing', () => {
    for (const beats of [DEFAULT_JUMP_BEATS, beatsFor('s02->s03')]) {
      expect(ambientWeight(0, false, beats)).toBe(1);
      expect(ambientWeight(beats.charge[1] / 2, false, beats)).toBeCloseTo(.5);
      for (const t of [beats.charge[1], .3, .5, .6, beats.land[0]]) expect(ambientWeight(t, false, beats)).toBe(0);
      expect(ambientWeight((beats.land[0] + 1) / 2, false, beats)).toBeCloseTo(.5);
      expect(ambientWeight(1, false, beats)).toBe(1);
    }
    expect(ambientWeight(null)).toBe(1); expect(ambientWeight(.9, true)).toBe(0);
  });
});

describe('readiness presentation does not consume narrative progress', () => {
  it('holds at beat four, retains requested t, and clears as soon as ready', () => {
    for (const t of [.1, .48, .57, .8]) {
      expect(readinessPresentation(t, false, false).hold).toBe(t >= .48);
      expect(readinessPresentation(t, true, false)).toEqual({ hold: false, poster: false });
    }
    expect(readinessPresentation(.55, false, true)).toEqual({ hold: true, poster: true });
    const runtime = createRuntime(); runtime.intro.cancel();
    const mapped = mapUnits(SCROLL_MAP[1].departure + 110 * .7);
    Object.assign(runtime, mapped, { narrativeLocal: mapped.local, local: mapped.b });
    evaluateRuntime(runtime); const pending = JSON.stringify(runtime.transition);
    runtime.assetsReady = true; evaluateRuntime(runtime);
    expect(JSON.stringify(runtime.transition)).toBe(pending);
    expect(runtime.progress).toBe(mapped.progress);
  });
});

describe('transition consumers', () => {
  it('applies portal channels and fractional scene/light weights without accumulating opacity', () => {
    const runtime = createRuntime(); runtime.intro.cancel();
    runtime.scene = 's01'; runtime.narrativeLocal = 1; runtime.b = 1;
    evaluateRuntime(runtime);
    const intent = runtime.transition!;
    intent.portal = { anchor: [2, 3, 4], radius: 2, open: .6, previewOn: true };
    intent.dissolve = .3; intent.particles = { progress: .4, opacity: .8 };
    const transport = new TransportChannels(); transport.apply(intent);
    expect(transport.portal.position.toArray()).toEqual([2, 3, 4]);
    expect(transport.portal.scale.toArray()).toEqual([2, 2, 2]);
    expect(transport.uniforms.open.value).toBe(.6);
    expect(transport.uniforms.previewOn.value).toBe(true);
    expect(transport.uniforms.dissolve.value).toBe(.3);
    expect(transport.uniforms.particleProgress.value).toBe(.4);
    expect(transport.uniforms.particleOpacity.value).toBe(.8);
    const root = new Group(); const material = new MeshBasicMaterial({ opacity: .8 });
    const mesh = new Mesh(new BoxGeometry(), material); const light = new PointLight(0xffffff, 4);
    root.add(mesh, light); const presentation = new ScenePresentation();
    for (let n = 0; n < 3; n++) {
      const version = material.version;
      presentation.apply(root, .5, .25);
      expect(material.opacity).toBe(.4); expect(light.intensity).toBe(1);
      expect(material.version).toBeGreaterThan(version);
      presentation.restore();
      expect(material.opacity).toBe(.8); expect(material.transparent).toBe(false); expect(light.intensity).toBe(4);
    }
    mesh.geometry.dispose(); material.dispose();
  });
  it('samples both robot clips, pose weight and material dissolve through the composer', () => {
    const robot = new Group(); const joint = new Group(); joint.name = 'Root'; robot.add(joint);
    const material = new MeshBasicMaterial({ opacity: .6 });
    const mesh = new Mesh(new BoxGeometry(), material); robot.add(mesh);
    const clips = [new AnimationClip('Draw', 1, [new VectorKeyframeTrack('Root.position', [0, 1], [0, 0, 0, 2, 0, 0])]), new AnimationClip('Wave', 1, [new VectorKeyframeTrack('Root.position', [0, 1], [0, 0, 0, 6, 0, 0])])];
    const composer = new RobotComposer(); composer.bind(robot, clips);
    const a = { kind: 'clip' as const, name: 'Draw' as const, timeSeconds: 1, weight: 1 };
    const b = { ...a, name: 'Wave' as const };
    composer.compose(a, { time: 0, delta: 0, ambientWeight: 0, reduced: false, canLook: false, target: null, reaction: null, transitionPose: { clipA: a, clipB: b, weight: .25, pose: 'rest', poseWeight: .5 } });
    expect(joint.position.x).toBeCloseTo(1.5);
    composer.materialLayer(.5); expect(material.opacity).toBeCloseTo(.3);
    composer.materialLayer(0); expect(material.opacity).toBe(.6);
    composer.dispose(); mesh.geometry.dispose(); material.dispose();
  });
});

it('reduced service/project selection changes the still content while keeping clocks and transitions frozen', () => {
  const runtime = createRuntime(); runtime.profile.motion = 'reduced';
  for (let n = 1; n <= 6; n++) {
    runtime.selection = { station: n, project: n - 1 };
    runtime.scene = 's03'; evaluateRuntime(runtime);
    expect(runtime.snapshot!.visual.station).toBe(n);
    expect(runtime.transition).toBeNull();
    runtime.scene = 's05'; evaluateRuntime(runtime);
    expect(runtime.snapshot!.visual.project).toBe(n - 1);
    expect(runtime.snapshot!.visual.activeTarget).toBe(n - 1);
    expect(runtime.snapshot!.visual.open).toBe(1);
    expect(runtime.clocks.value.ambientTime).toBe(0);
  }
});
it('defaults capture to the completed hero unless an intro sample is explicit', () => {
  const runtime = createRuntime();
  runtime.clocks.setCapture(captureTimes('?capture=1&ambient=6'));
  evaluateRuntime(runtime);
  expect(runtime.snapshot!.robot).toMatchObject({ name: 'Idle' });
  runtime.intro.cancel(); evaluateRuntime(runtime);
  expect(runtime.snapshot!.visual.headlineReveal).toBe(100);
  runtime.clocks.setCapture({ ambientTime: 6, introTime: 0 }); evaluateRuntime(runtime);
  expect(runtime.snapshot!.robot).toMatchObject({ name: 'Sleep' });
});
it('moves an implicit dissolve with an overridden dive and keeps explicit dissolve intervals', () => {
  expect(resolveBeats({ dive: [.2, .4] }).dissolve).toEqual([.34, .4]);
  expect(resolveBeats({ dive: [.2, .4], dissolve: [.3, .35] }).dissolve).toEqual([.3, .35]);
});
it('keeps covered opaque materials on their warmed shader variant', () => {
  const root = new Group(); const material = new MeshBasicMaterial();
  const mesh = new Mesh(new BoxGeometry(), material); root.add(mesh);
  const presentation = new ScenePresentation(); const version = material.version;
  presentation.apply(root, .4, 1, true); presentation.restore();
  expect(material.transparent).toBe(false); expect(material.version).toBe(version);
  mesh.geometry.dispose(); material.dispose();
});

it('fades bounded angular offsets at long ambient times without rewinding whole revolutions', () => {
  for (const rate of [.45, .5, .8]) {
    for (const time of [120, 125.7, 10_000]) {
      const full = ambientAngle(time, rate);
      expect(Math.abs(full)).toBeLessThanOrEqual(Math.PI);
      for (const weight of [1, .75, .5, .25, 0]) expect(ambientAngle(time, rate, weight)).toBeCloseTo(full * weight);
      expect(Math.cos(ambientAngle(time, rate))).toBeCloseTo(Math.cos(time * rate));
    }
  }
  const out = nodeState();
  writeMotion(out, { name: 'spinner', kind: 'float', spin: true }, 1, { time: 125.7, reducedMotion: false, ambientWeight: .5, screenCount: 3 });
  expect(Math.abs(out.rotation[1] - 12 * .45)).toBeLessThanOrEqual(Math.PI / 2);
});
it('fades the screen result toward canonical texture zero without scaling its animation clock', () => {
  const sample = (weight: number) => {
    const out = nodeState();
    writeMotion(out, { name: 'screen', kind: 'screen', phase: .3 }, 1, { time: 125.7, reducedMotion: false, ambientWeight: weight, screenCount: 3 });
    return out.screen;
  };
  const full = sample(1);
  for (const weight of [1, .75, .5, .25, 0]) {
    expect(sample(weight)).toEqual({ ...full, weight });
  }
});
