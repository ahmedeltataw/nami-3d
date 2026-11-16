'use client';

/* eslint-disable react-hooks/immutability -- R3F uniforms are imperative objects, outside React state. */
import { useEffect, useImperativeHandle, useMemo, useState, type Ref } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Profile } from '../../profile';
import { createParticleCore, type ParticleCore } from './core';
import type { ParticleFrame } from './motion';
import type { TargetFunction } from './attributes';
import type { PresetSelection } from './presets';

export type ParticleFieldHandle = Pick<ParticleCore, 'setTargets' | 'setPreset' | 'material'>;
export type ParticleFieldProps = {
  profile: Profile;
  seed?: number;
  active?: boolean;
  preset?: PresetSelection;
  targetFn?: TargetFunction;
  /** Mutable narrative input; update in place without a React render. Time defaults to the R3F clock. */
  state?: ParticleFrame;
  ref?: Ref<ParticleFieldHandle>;
};

function WebGLParticleField({ profile, seed = 1, active = true, preset = 'ambient', targetFn, state, ref }: ParticleFieldProps) {
  // Preset changes update weights only; target generation belongs to the initial preset or explicit targetFn.
  const [initialPreset] = useState(() => preset);
  const core = useMemo(() => createParticleCore({ quality: profile.quality, seed, preset: initialPreset, targetFn }), [profile.quality, seed, initialPreset, targetFn]);
  const defaultFrame = useMemo<ParticleFrame>(() => ({ progress: 0, time: 0 }), []);
  useImperativeHandle(ref, () => core, [core]);
  useEffect(() => { core.setPreset(preset); }, [core, preset]);
  useEffect(() => () => core.dispose(), [core]);
  useFrame(root => {
    if (!active) return;
    defaultFrame.time = root.clock.elapsedTime;
    core.update(state ?? defaultFrame, root.gl.getPixelRatio(), profile.motion === 'reduced');
  });
  return <points name="ParticleField" geometry={core.geometry} material={core.material} visible={active} frustumCulled={false} dispose={null} />;
}

/** The fallback path is safe outside a Canvas and never creates GPU resources. */
export function ParticleField(props: ParticleFieldProps) {
  return props.profile.renderer === 'fallback' ? null : <WebGLParticleField {...props} />;
}
