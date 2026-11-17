'use client';

/* eslint-disable react-hooks/immutability -- R3F uniforms are imperative objects, outside React state. */
import { useEffect, useImperativeHandle, useMemo, useState, type Ref } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Profile } from '../../profile';
import { createParticleCore, type ParticleCore } from './core';
import type { ParticleFrame } from './motion';
import type { TargetFunction } from './attributes';
import type { PresetSelection } from './presets';
import { useMotionRuntime } from '../../RuntimeContext';

export type ParticleFieldHandle = Pick<ParticleCore, 'setTargets' | 'setPreset' | 'material'>;
export type ParticleFieldProps = {
  profile: Profile;
  seed?: number;
  active?: boolean;
  preset?: PresetSelection;
  targetFn?: TargetFunction;
  /** Mutable narrative input; update in place without a React render. Time comes from the shared ambient clock. */
  state?: ParticleFrame;
  ref?: Ref<ParticleFieldHandle>;
};

function WebGLParticleField({ profile, seed = 1, active = true, preset = 'ambient', targetFn, state, ref }: ParticleFieldProps) {
  const runtime = useMotionRuntime();
  // Preset changes update weights only; target generation belongs to the initial preset or explicit targetFn.
  const [initialPreset] = useState(() => preset);
  const core = useMemo(() => createParticleCore({ quality: profile.quality, seed, preset: initialPreset, targetFn }), [profile.quality, seed, initialPreset, targetFn]);
  const defaultFrame = useMemo<ParticleFrame>(() => ({ progress: 0, time: 0 }), []);
  useImperativeHandle(ref, () => core, [core]);
  useEffect(() => { core.setPreset(preset); }, [core, preset]);
  useEffect(() => () => core.dispose(), [core]);
  useFrame((root, delta) => {
    if (!active) return;
    defaultFrame.time = runtime?.clocks.value.ambientTime ?? (defaultFrame.time + (profile.motion === 'reduced' ? 0 : Math.min(.1, delta)));
    const frame = state ?? defaultFrame;
    frame.time = defaultFrame.time;
    core.material.uniforms.uAmbientWeight.value = runtime?.ambientWeight ?? 1;
    core.update(frame, root.gl.getPixelRatio(), profile.motion === 'reduced');
  });
  return <points name="ParticleField" geometry={core.geometry} material={core.material} visible={active} frustumCulled={false} dispose={null} />;
}

/** The fallback path is safe outside a Canvas and never creates GPU resources. */
export function ParticleField(props: ParticleFieldProps) {
  return props.profile.renderer === 'fallback' ? null : <WebGLParticleField {...props} />;
}
