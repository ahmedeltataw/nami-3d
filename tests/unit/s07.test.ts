import { describe, expect, it } from 'vitest';
import { scene as s07 } from '../../src/experience/scenes/s07/scene';
import { scene as s06 } from '../../src/experience/scenes/s06/scene';
import { createChoiceStateMachine, TRANSITION_DURATION } from '../../src/experience/scenes/s07/state';
import { useExperienceStore } from '../../src/experience/store';
import type { SampleInput, SceneSnapshot } from '../../src/experience/contracts';
import s07Manifest from '../../assets-model/export/s07_future_v2.manifest.json';

const baseInput: SampleInput = {
  local: 0,
  viewport: { w: 1280, h: 800, dpr: 1.5 },
  profile: { quality: 'mid', motion: 'full', renderer: 'webgl' },
  interaction: { source: null, token: 0, reaction: null },
  seed: 1,
  ambient: 0,
};

describe('S07 Choice State Machine', () => {
  it('handles choice selection with 0.9s dissolve and assemble phases', () => {
    const sm = createChoiceStateMachine();
    const t0 = 10.0;

    sm.select('website', t0);
    expect(sm.getState().targetChoice).toBe('website');
    expect(sm.getState().duration).toBe(TRANSITION_DURATION);

    // Initial state at t0
    const sample0 = sm.sample(t0);
    expect(sample0.phase).toBe('dissolve');
    expect(sample0.coreOpacity).toBeCloseTo(1.0, 2);
    expect(sample0.shapeOpacity).toBe(0);

    // Mid-dissolve at t0 + 0.225s (25% progress)
    const sampleQuarter = sm.sample(t0 + 0.225);
    expect(sampleQuarter.phase).toBe('dissolve');
    expect(sampleQuarter.coreOpacity).toBeCloseTo(0.5, 2);
    expect(sampleQuarter.shapeOpacity).toBe(0);

    // End of dissolve / start of assemble at t0 + 0.45s (50% progress)
    const sampleMid = sm.sample(t0 + 0.45);
    expect(sampleMid.coreOpacity).toBeCloseTo(0, 2);

    // Mid-assemble at t0 + 0.675s (75% progress)
    const sampleThreeQuarters = sm.sample(t0 + 0.675);
    expect(sampleThreeQuarters.phase).toBe('assemble');
    expect(sampleThreeQuarters.shapeOpacity).toBeCloseTo(0.5, 2);
    expect(sampleThreeQuarters.coreOpacity).toBe(0);

    // Fully assembled at t0 + 0.90s (100% progress)
    const sampleEnd = sm.sample(t0 + 0.9);
    expect(sampleEnd.phase).toBe('assembled');
    expect(sampleEnd.shapeOpacity).toBeCloseTo(1.0, 2);
    expect(sampleEnd.shapeScale).toBeCloseTo(1.0, 2);
    expect(sampleEnd.coreOpacity).toBe(0);
  });

  it('cancels and rebases immediately upon quick second selection without queueing', () => {
    const sm = createChoiceStateMachine();
    const t0 = 10.0;

    // First choice: website
    sm.select('website', t0);
    expect(sm.getState().targetChoice).toBe('website');

    // After 0.3s (mid-transition), user selects 'mobile'
    const tSecond = t0 + 0.3;
    sm.select('mobile', tSecond);

    const state = sm.getState();
    // Rebased: target immediately changed to mobile
    expect(state.targetChoice).toBe('mobile');
    expect(state.startTime).toBe(tSecond);
    expect(state.duration).toBe(TRANSITION_DURATION);

    // New 0.9s transition completes at tSecond + 0.9
    const midSecond = sm.sample(tSecond + 0.45);
    expect(midSecond.progress).toBeCloseTo(0.5, 2);

    const endSecond = sm.sample(tSecond + 0.9);
    expect(endSecond.phase).toBe('assembled');
    expect(endSecond.shapeOpacity).toBeCloseTo(1.0, 2);
    expect(sm.getState().targetChoice).toBe('mobile');
  });

  it('resets back to initial glowing core state', () => {
    const sm = createChoiceStateMachine();
    sm.select('marketing', 5.0);
    expect(sm.getState().targetChoice).toBe('marketing');

    sm.reset();
    expect(sm.getState().targetChoice).toBeNull();
    const sample = sm.sample(10.0);
    expect(sample.phase).toBe('idle');
    expect(sample.coreOpacity).toBe(1.0);
    expect(sample.shapeOpacity).toBe(0);
  });
});

describe('S07 Determinism & Continuity across 25 points', () => {
  it('direct == forward == reverse across 25 sampled locals', () => {
    const points = Array.from({ length: 25 }, (_, i) => i / 24);

    const direct = points.map(local => s07.sample({ ...baseInput, local }));

    const forward: SceneSnapshot[] = [];
    for (const local of points) {
      forward.push(s07.sample({ ...baseInput, local }));
    }
    expect(forward).toEqual(direct);

    const reverse: SceneSnapshot[] = [];
    for (const local of [...points].reverse()) {
      reverse.push(s07.sample({ ...baseInput, local }));
    }
    expect(reverse.reverse()).toEqual(direct);
  });

  it('S07 entry pose matches v2 manifest hero camera and S06 exit robot rest', () => {
    const s06Exit = s06.sample({ ...baseInput, local: 1.0 });
    const s07Entry = s07.sample({ ...baseInput, local: 0.0 });

    expect(s07Entry.camera.position).toEqual(s07Manifest.camera_hero.position_gltf);
    expect(s07Entry.camera.fov).toBe(s07Manifest.camera_hero.vertical_fov_deg);
    expect(s07Entry.camera.far).toBe(s07Manifest.camera_hero.clip[1]);
    expect(s07Entry.robot).toEqual(s06Exit.robot);
  });

  it('samples beats: core appearance in 0.00–0.30, options ready in 0.30–1.00', () => {
    const snapStart = s07.sample({ ...baseInput, local: 0.0 });
    expect(snapStart.visual.coreAppearance).toBe(0);
    expect(snapStart.visual.optionsReady).toBe(false);

    const snapMid = s07.sample({ ...baseInput, local: 0.15 });
    expect(snapMid.visual.coreAppearance).toBeCloseTo(0.5, 2);
    expect(snapMid.visual.optionsReady).toBe(false);
    expect(snapMid.robot).toMatchObject({ kind: 'clip', name: 'Wave' });

    const snapReady = s07.sample({ ...baseInput, local: 0.30 });
    expect(snapReady.visual.coreAppearance).toBe(1.0);
    expect(snapReady.visual.optionsReady).toBe(true);
    expect(snapReady.robot).toEqual({ kind: 'rest' });

    const snapEnd = s07.sample({ ...baseInput, local: 1.0 });
    expect(snapEnd.visual.coreAppearance).toBe(1.0);
    expect(snapEnd.visual.optionsReady).toBe(true);
    expect(snapEnd.robot).toEqual({ kind: 'rest' });
  });

  it('reduced motion returns final ready state with no travel', () => {
    const reduced = s07.sample({
      ...baseInput,
      local: 0.1,
      profile: { ...baseInput.profile, motion: 'reduced' },
    });

    expect(reduced.camera.position).toEqual(s07Manifest.camera_hero.position_gltf);
    expect(reduced.robot).toEqual({ kind: 'pose', name: 'rest' });
    expect(reduced.visual.coreAppearance).toBe(1.0);
    expect(reduced.visual.coreSpin).toBe(0);
    expect(reduced.visual.optionsReady).toBe(true);
  });
});

describe('Zustand store projectType handling', () => {
  it('stores projectType and allows updates and resets', () => {
    expect(useExperienceStore.getState().projectType).toBeNull();

    useExperienceStore.getState().setProjectType('website');
    expect(useExperienceStore.getState().projectType).toBe('website');

    useExperienceStore.getState().setProjectType('mobile');
    expect(useExperienceStore.getState().projectType).toBe('mobile');

    useExperienceStore.getState().setProjectType('marketing');
    expect(useExperienceStore.getState().projectType).toBe('marketing');

    useExperienceStore.getState().setProjectType('other');
    expect(useExperienceStore.getState().projectType).toBe('other');

    useExperienceStore.getState().setProjectType(null);
    expect(useExperienceStore.getState().projectType).toBeNull();
  });
});
