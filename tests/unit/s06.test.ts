import { describe, expect, it } from 'vitest';
import { scene as s06 } from '../../src/experience/scenes/s06/scene';
import {
  getValueIndex,
  getValueWindow,
  VALUES_COUNT,
  VALUES_START,
  VALUES_END,
  VALUE_WINDOW,
  getParticleTargetMode,
  getS06Phase,
  generateValueTargets,
} from '../../src/experience/scenes/s06/math';
import type { SampleInput, SceneSnapshot } from '../../src/experience/contracts';

const baseInput: SampleInput = {
  local: 0,
  viewport: { w: 1280, h: 800, dpr: 1.5 },
  profile: { quality: 'mid', motion: 'full', renderer: 'webgl' },
  interaction: { source: null, token: 0, reaction: null },
  seed: 1,
  ambient: 0,
};

describe('S06 NAMI DNA - Window Math & Value Index', () => {
  it('divides the 0.10–0.70 range into 7 strictly equal windows', () => {
    expect(VALUES_COUNT).toBe(7);
    expect(VALUES_START).toBe(0.10);
    expect(VALUES_END).toBe(0.70);
    expect(VALUE_WINDOW).toBeCloseTo(0.60 / 7, 8);

    for (let i = 0; i < 7; i++) {
      const window = getValueWindow(i);
      expect(window.start).toBeCloseTo(0.10 + i * (0.60 / 7), 8);
      expect(window.end).toBeCloseTo(0.10 + (i + 1) * (0.60 / 7), 8);
    }
  });

  it('correctly maps local progress to the 7 value indices', () => {
    // Before values range
    expect(getValueIndex(0.0)).toBe(0);
    expect(getValueIndex(0.09)).toBe(0);

    // Within each of the 7 windows
    const span = 0.60 / 7;
    for (let i = 0; i < 7; i++) {
      const mid = 0.10 + (i + 0.5) * span;
      expect(getValueIndex(mid)).toBe(i);
    }

    // At boundaries
    expect(getValueIndex(0.10)).toBe(0);
    expect(getValueIndex(0.10 + span * 1)).toBe(1);
    expect(getValueIndex(0.10 + span * 2)).toBe(2);
    expect(getValueIndex(0.10 + span * 6)).toBe(6);

    // After values range
    expect(getValueIndex(0.70)).toBe(6);
    expect(getValueIndex(0.85)).toBe(6);
    expect(getValueIndex(1.0)).toBe(6);
  });
});

describe('S06 Determinism across 25 points', () => {
  it('direct == forward == reverse across 25 sampled locals', () => {
    const points = Array.from({ length: 25 }, (_, i) => i / 24);

    const direct = points.map(local => s06.sample({ ...baseInput, local }));

    const forward: SceneSnapshot[] = [];
    for (const local of points) {
      forward.push(s06.sample({ ...baseInput, local }));
    }
    expect(forward).toEqual(direct);

    const reverse: SceneSnapshot[] = [];
    for (const local of [...points].reverse()) {
      reverse.push(s06.sample({ ...baseInput, local }));
    }
    expect(reverse.reverse()).toEqual(direct);
  });
});

describe('S06 Particle Target Mode & Phases', () => {
  it('progresses through ambient, values (0..6), converge, and reveal phases', () => {
    // 0.00..0.10: ambient
    expect(getS06Phase(0.0)).toBe('ambient');
    expect(getS06Phase(0.05)).toBe('ambient');
    expect(getParticleTargetMode(0.05)).toBe('ambient');
    const snapAmbient = s06.sample({ ...baseInput, local: 0.05 });
    expect(snapAmbient.visual.phase).toBe('ambient');
    expect(snapAmbient.visual.particleMode).toBe('ambient');
    expect(snapAmbient.robot).toMatchObject({ kind: 'clip', name: 'Idle' });

    // 0.10..0.70: values 0..6 with alternating gestures
    const span = 0.60 / 7;
    for (let i = 0; i < 7; i++) {
      const local = 0.10 + (i + 0.5) * span;
      expect(getS06Phase(local)).toBe('values');
      expect(getParticleTargetMode(local)).toBe(`value_${i}`);

      const snapVal = s06.sample({ ...baseInput, local });
      expect(snapVal.visual.phase).toBe('values');
      expect(snapVal.visual.valueIndex).toBe(i);
      expect(snapVal.visual.particleMode).toBe(`value_${i}`);

      // Even index: Wave (Present), Odd index: Point
      if (i % 2 === 0) {
        expect(snapVal.robot).toMatchObject({ kind: 'clip', name: 'Wave' });
      } else {
        expect(snapVal.robot).toMatchObject({ kind: 'point', target: 'S06_ValueTarget' });
      }
    }

    // 0.70..0.90: converge
    expect(getS06Phase(0.75)).toBe('converge');
    expect(getParticleTargetMode(0.75)).toBe('logo');
    const snapConverge = s06.sample({ ...baseInput, local: 0.80 });
    expect(snapConverge.visual.phase).toBe('converge');
    expect(snapConverge.visual.particleMode).toBe('logo');
    expect(snapConverge.visual.convergeProgress).toBeCloseTo(0.5, 2);
    expect(snapConverge.visual.logoOpacity).toBe(0);

    // 0.90..1.00: reveal (crossfade to real logo mesh)
    expect(getS06Phase(0.95)).toBe('reveal');
    expect(getParticleTargetMode(0.95)).toBe('logo');
    const snapReveal = s06.sample({ ...baseInput, local: 0.95 });
    expect(snapReveal.visual.phase).toBe('reveal');
    expect(snapReveal.visual.logoOpacity).toBeCloseTo(0.5, 2);
    expect(snapReveal.visual.particleOpacity).toBeCloseTo(0.5, 2);

    // Endpoint 1.0: logoOpacity = 1, robot rest
    const snapEnd = s06.sample({ ...baseInput, local: 1.0 });
    expect(snapEnd.visual.logoOpacity).toBe(1);
    expect(snapEnd.visual.particleOpacity).toBe(0);
    expect(snapEnd.robot).toEqual({ kind: 'rest' });
  });

  it('generates strictly finite 3D targets for all 7 values', () => {
    for (let i = 0; i < 7; i++) {
      const targets = generateValueTargets(i, 100, 42);
      expect(targets.length).toBe(300);
      for (let j = 0; j < targets.length; j++) {
        expect(Number.isFinite(targets[j])).toBe(true);
      }
    }
  });
});

describe('S06 Reduced Motion & Poses', () => {
  it('returns final revealed state with no travel under reduced motion', () => {
    const reduced = s06.sample({
      ...baseInput,
      local: 0.2,
      profile: { ...baseInput.profile, motion: 'reduced' },
    });

    expect(reduced.camera.position).toEqual([0, 0, 4.4]);
    expect(reduced.robot).toEqual({ kind: 'pose', name: 'rest' });
    expect(reduced.visual.logoOpacity).toBe(1);
    expect(reduced.visual.particleOpacity).toBe(0);
    expect(reduced.visual.phase).toBe('reveal');
  });

  it('entry pose of S06 matches exit pose of S05', () => {
    const entry = s06.sample({ ...baseInput, local: 0 });
    // S05 exit camera position is [0, 0, 4.75], fov 50
    expect(entry.camera.position[2]).toBeCloseTo(4.75, 2);
    expect(entry.camera.fov).toBe(50);
  });
});
