import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import type { AssetKey, SampleInput, SceneId, TransitionId, TransitionCtx } from '../../src/experience/contracts';
import { SCENE_IDS, SCROLL_BUDGETS, TOTAL_BUDGET, mapScroll, scrollForScene, SCROLL_MAP, localForBody, bodyProgress } from '../../src/experience/controller';
import { scenes } from '../../src/experience/scenes';
import { mountedScenes, residentScenes, sampleBoundary, transitionAt, transitions } from '../../src/experience/transitions';
import { TransitionResidency } from '../../src/experience/transitions/residency';
import { AssetResidency, keysForScene, type ResidentAsset } from '../../src/experience/assets/residency';
import { beatsFor } from '../../src/experience/transitions/beats';

const input: SampleInput = { local: 0, viewport: { w: 1280, h: 800, dpr: 1 }, profile: { motion: 'full', quality: 'mid', renderer: 'webgl' }, interaction: { source: null, token: 0, reaction: null }, seed: 1, ambient: 0 };
const sample = (scene: SceneId, local: number, reduced = false) => {
  const i = { ...input, local: bodyProgress(scene, local), narrativeLocal: local, profile: { ...input.profile, motion: reduced ? 'reduced' as const : 'full' as const } };
  return sampleBoundary(scene, i, scenes[scene].sample(i));
};

describe('boundary sampling', () => {
  it('registers exactly the six adjacent boundaries with unchanged scroll budgets', () => {
    expect(Object.keys(transitions)).toEqual(SCENE_IDS.slice(0, -1).map((id, i) => `${id}->${SCENE_IDS[i + 1]}`));
    expect(SCROLL_BUDGETS).toEqual([180, 240, 540, 320, 480, 420, 100]);
    expect(TOTAL_BUDGET).toBe(2280);
  });

  it.each(Object.values(transitions))('$from -> $to is direct == reverse and swaps ownership only under its wash', def => {
    const [start, end] = def.window;
    const points = [[def.from, start], [def.from, (start + 1) / 2], [def.to, 0], [def.to, end / 2], [def.to, end - 1e-8]] as const;
    const direct = points.map(([id, local]) => sample(id, local));
    expect([...points].reverse().map(([id, local]) => sample(id, local)).reverse()).toEqual(direct);
    for (const result of direct) {
      const snap = result.transition!;
      expect(JSON.parse(JSON.stringify(snap))).toEqual(snap);
      expect(snap.fromVisibility + snap.toVisibility).toBeCloseTo(1);
      const ctx: TransitionCtx = { intents: null }; def.apply(snap, ctx); expect(ctx.intents).toBe(snap);
    }
    expect(direct[0].transition!.progress).toBeCloseTo(0);
    expect(direct.at(-1)!.transition!.progress).toBeCloseTo(1, 6);
    expect(transitionAt(def.from, 1)!.progress).toBeCloseTo(transitionAt(def.to, 0)!.progress);
    expect(transitionAt(def.to, end)).toBeNull();
    const from = scenes[def.from].sample({ ...input, local: 1 });
    const to = scenes[def.to].sample({ ...input, local: 0 });
    const beats = beatsFor(`${def.from}->${def.to}` as TransitionId);
    for (const t of [beats.opaque[0] - 1e-7, beats.opaque[0] + 1e-7, beats.opaque[1] - 1e-7, beats.opaque[1] + 1e-7]) {
      const snap = def.sample(t, { ...input, active: def.from, from, to, camera: { from: from.camera, to: to.camera, blend: t } });
      const source = t < (beats.opaque[0] + beats.opaque[1]) / 2;
      expect(snap.owner).toBe(source ? def.from : def.to);
      expect(snap.camera.from.fov).toBe(source ? from.camera.fov : to.camera.fov);
      expect(snap.camera.to.fov).toBe(snap.camera.from.fov);
      expect(snap.lights).toEqual({ aWeight: Number(source), bWeight: Number(!source) });
      if (t > beats.opaque[0] && t < beats.opaque[1]) expect(snap.wash).toBe(1);
    }
  });

  it('warms forward at body .5, reverse within one viewport, and excludes jumps from reduced motion', () => {
    for (let i = 0; i < 6; i++) {
      const id = SCENE_IDS[i];
      expect(residentScenes(id, localForBody(id, .5))).toContain(SCENE_IDS[i + 1]);
      expect(mountedScenes(id, localForBody(id, .5))).toEqual([id]);
      const next = SCROLL_MAP[i + 1];
      const reverseBody = localForBody(next.id, .1);
      expect(mountedScenes(next.id, reverseBody)).toEqual([next.id]);
      expect(residentScenes(next.id, reverseBody, false, -1)).toContain(id);
      if (next.body > 100) expect(residentScenes(next.id, localForBody(next.id, 101 / next.body), false, -1)).toEqual([next.id]);
      expect(mountedScenes(id, .95, true)).toEqual([id]);
      expect(sample(id, .95, true).transition).toBeNull();
      const position = mapScroll(scrollForScene(id, .95, 800), 800);
      expect(position.scene).toBe(id); expect(position.b).toBeCloseTo(.95);
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
    expect(residency.consumers('s03.kit')).toBe(1);
    expect(residency.consumers('s04.kit')).toBe(1);
    session.update(keysForScene('s04'), [], ready, failed);
    expect(residency.consumers('s03.kit')).toBe(0);
    expect(residency.isResident('s03.kit')).toBe(false);
    expect(residency.consumers('s04.kit')).toBe(1);
    session.release();
    expect(residency.consumers('s04.kit')).toBe(0);
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
