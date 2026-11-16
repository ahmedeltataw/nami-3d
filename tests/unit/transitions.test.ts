import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import type { AssetKey, SampleInput, SceneId, TransitionCtx } from '../../src/experience/contracts';
import { SCENE_IDS, SCROLL_BUDGETS, TOTAL_BUDGET, mapScroll, scrollForScene } from '../../src/experience/controller';
import { scenes } from '../../src/experience/scenes';
import { mountedScenes, residentScenes, sampleBoundary, transitionAt, transitions } from '../../src/experience/transitions';
import { TransitionResidency } from '../../src/experience/transitions/residency';
import { AssetResidency, keysForScene, type ResidentAsset } from '../../src/experience/assets/residency';
import { CameraRig } from '../../src/experience/camera/CameraRig';
import { PerspectiveCamera } from 'three';

const input: SampleInput = { local: 0, viewport: { w: 1280, h: 800, dpr: 1 }, profile: { motion: 'full', quality: 'mid', renderer: 'webgl' }, interaction: { source: null, token: 0, reaction: null }, seed: 1, ambient: 0 };
const sample = (scene: SceneId, local: number, reduced = false) => {
  const i = { ...input, local, profile: { ...input.profile, motion: reduced ? 'reduced' as const : 'full' as const } };
  return sampleBoundary(scene, i, scenes[scene].sample(i));
};

describe('boundary sampling', () => {
  it('registers exactly the six adjacent boundaries with unchanged scroll budgets', () => {
    expect(Object.keys(transitions)).toEqual(SCENE_IDS.slice(0, -1).map((id, i) => `${id}->${SCENE_IDS[i + 1]}`));
    expect(SCROLL_BUDGETS).toEqual([180, 240, 540, 320, 480, 420, 100]);
    expect(TOTAL_BUDGET).toBe(2280);
  });

  it.each(Object.values(transitions))('$from -> $to is direct == forward == reverse and JSON round trips', def => {
    const points = [[def.from, .9], [def.from, .95], [def.to, 0], [def.to, .05], [def.to, .1]] as const;
    const direct = points.map(([id, local]) => sample(id, local));
    const reverse = [...points].reverse().map(([id, local]) => sample(id, local)).reverse();
    expect(reverse).toEqual(direct);
    for (const [i, [id, local]] of points.entries()) {
      const snap = direct[i].transition!;
      expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
      expect(mountedScenes(id, local)).toEqual([def.from, def.to]);
      expect(snap.fromVisibility).toBe(Number(id === def.from));
      expect(snap.toVisibility).toBe(Number(id === def.to));
      const camera = new PerspectiveCamera();
      const rig = new CameraRig();
      rig.setPoses(snap.camera.from, snap.camera.to, { blend: snap.camera.blend, snap: true });
      rig.apply(camera, 0);
      const baseline = new CameraRig();
      const active = scenes[id].sample({ ...input, local });
      const index = SCENE_IDS.indexOf(id);
      const previous = index > 0 && id !== 's03' && id !== 's05' ? scenes[SCENE_IDS[index - 1]].sample({ ...input, local: 1 }).camera : active.camera;
      baseline.setPoses(previous, active.camera, { blend: local / .08, snap: true });
      const expected = new PerspectiveCamera();
      baseline.apply(expected, 0);
      expect(camera.position.toArray()).toEqual(expected.position.toArray());
      expect(camera.quaternion.toArray()).toEqual(expected.quaternion.toArray());
      expect(camera.fov).toBe(expected.fov);
      const ctx: TransitionCtx = { intents: null };
      def.apply(snap, ctx);
      expect(ctx.intents).toBe(snap);
    }
    expect(direct[0].transition!.progress).toBeCloseTo(0);
    expect(direct.at(-1)!.transition!.progress).toBeCloseTo(1);
    const end = transitionAt(def.from, 1)!.progress;
    expect(transitionAt(def.to, 0)!.progress).toBeCloseTo(end);
    expect(transitionAt(def.to, .10001)).toBeNull();
  });

  it('warms the next scene before the window, handles reverse entry, and snaps reduced motion', () => {
    for (let i = 0; i < 6; i++) {
      expect(residentScenes(SCENE_IDS[i], .85)).toContain(SCENE_IDS[i + 1]);
      expect(mountedScenes(SCENE_IDS[i], .85)).toEqual([SCENE_IDS[i]]);
      expect(residentScenes(SCENE_IDS[i + 1], .15)).toContain(SCENE_IDS[i]);
      expect(mountedScenes(SCENE_IDS[i], .95, true)).toEqual([SCENE_IDS[i]]);
      expect(sample(SCENE_IDS[i], .95, true).transition).toBeNull();
      const y = scrollForScene(SCENE_IDS[i], .95, 800);
      const position = mapScroll(y, 800);
      expect(position.scene).toBe(SCENE_IDS[i]);
      expect(position.local).toBeCloseTo(.95);
    }
  });
});

describe('transition lease reconciliation', () => {
  it('keeps both scenes through a boundary and releases the source after leaving it', async () => {
    const residency = new AssetResidency(async key => ({ value: key, dispose() {} }), 'mid');
    const session = new TransitionResidency(residency);
    const ready = vi.fn();
    const failed = vi.fn();
    session.update(keysForScene('s03'), keysForScene('s04'), ready, failed);
    await vi.waitFor(() => expect(ready).toHaveBeenCalledOnce());
    session.update([...keysForScene('s04'), ...keysForScene('s03')], [], ready, failed);
    expect(residency.consumers('lab.shell')).toBe(1);
    expect(residency.consumers('phone.kit')).toBe(1);
    session.update(keysForScene('s04'), [], ready, failed);
    expect(residency.consumers('lab.shell')).toBe(0);
    expect(residency.isResident('lab.shell')).toBe(false);
    expect(residency.consumers('phone.kit')).toBe(1);
    session.release();
    expect(residency.consumers('phone.kit')).toBe(0);
  });

  it('acquires new leases before cancellation and ignores late completions after rapid seeks', async () => {
    const pending = new Map<AssetKey, { resolve: (asset: ResidentAsset) => void; signal: AbortSignal }>();
    const residency = new AssetResidency((key, _quality, signal) => new Promise(resolve => pending.set(key, { resolve, signal })), 'mid');
    const session = new TransitionResidency(residency);
    const oldReady = vi.fn();
    const newReady = vi.fn();
    const failed = vi.fn();
    session.update(['poster:s03'], ['poster:s04'], oldReady, failed);
    await Promise.resolve();
    const acquire = vi.spyOn(residency, 'acquire');
    pending.get('poster:s03')!.signal.addEventListener('abort', () => expect(acquire).toHaveBeenCalledWith('poster:s07'));
    session.update(['poster:s07'], [], newReady, failed);
    await Promise.resolve();
    const dispose = vi.fn();
    pending.get('poster:s03')!.resolve({ value: 1, dispose });
    pending.get('poster:s04')!.resolve({ value: 2, dispose });
    pending.get('poster:s07')!.resolve({ value: 3, dispose() {} });
    await vi.waitFor(() => expect(newReady).toHaveBeenCalledOnce());
    expect(oldReady).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
    expect(dispose).toHaveBeenCalledTimes(2);
    session.release();
  });

  it('cancels an obsolete session without publishing ready or fallback', async () => {
    const residency = new AssetResidency(async () => ({ value: 1, dispose() {} }), 'mid');
    const session = new TransitionResidency(residency);
    const ready = vi.fn(); const failed = vi.fn();
    session.update(['poster:s03', 'poster:s04'], [], ready, failed);
    session.release();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(ready).not.toHaveBeenCalled();
    expect(failed).not.toHaveBeenCalled();
  });
});

describe('transform ownership', () => {
  it('keeps transition apply restricted to intents and camera/pose commits in their owners', () => {
    const root = join(process.cwd(), 'src/experience');
    const source = (path: string) => readFileSync(join(root, path), 'utf8');
    const calls = (path: string) => {
      const file = ts.createSourceFile(path, source(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
      const found: string[] = [];
      const visit = (node: ts.Node) => { if (ts.isCallExpression(node)) found.push(node.expression.getText(file)); ts.forEachChild(node, visit); };
      visit(file); return found;
    };
    expect(calls('Host.tsx').filter(call => call === 'rig.apply')).toHaveLength(1);
    expect(calls('robot/Robot.tsx').filter(call => call === 'composer.compose')).toHaveLength(1);
    for (const file of readdirSync(join(root, 'transitions')).filter(file => file.endsWith('.ts'))) {
      const text = source(`transitions/${file}`);
      expect(text).not.toMatch(/from ['"]three/);
      expect(calls(`transitions/${file}`).filter(call => /\.(position|quaternion|rotation|scale)\./.test(call))).toEqual([]);
    }
    for (const id of SCENE_IDS) {
      expect(calls(`scenes/${id}/index.tsx`).filter(call => /^(camera|robot)\.(position|quaternion|rotation)\./.test(call))).toEqual([]);
    }
  });
});
