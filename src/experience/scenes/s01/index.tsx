'use client';

import { useCallback, useMemo, useRef } from 'react';
import { type Group } from 'three';
import type { Ctx, SceneId } from '../../contracts';
import type { AssetResidency } from '../../assets/residency';
import { useSceneKit } from '../useSceneKit';

export default function Scene({
  register,
  residency,
  onError,
}: {
  register: (id: SceneId, ctx: Ctx | null) => void;
  residency: AssetResidency | null;
  onError: () => void;
}) {
  const root = useRef<Group>(null);
  const motes = useMemo(() => Float32Array.from(Array.from({ length: 18 }, (_, i) => [
    Math.sin(i * 2.4) * 2.2, Math.cos(i * 1.7) * 1.4, -0.8 - (i % 5) * 0.3,
  ]).flat()), []);

  const onMount = useCallback((_kit: Group, _extras: unknown[], { parent }: { parent: Group }) => ({
    ctx: { root: parent, ambient: 0, reducedMotion: false },
  }), []);

  useSceneKit({ sceneId: 's01', root, residency, register, onError, onMount });

  return <group ref={root} name="s01" visible={false} dispose={null}>
    <points name="s01-motes">
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[motes, 3]} /></bufferGeometry>
      <pointsMaterial color="#009f6f" size={0.018} transparent opacity={0.22} depthWrite={false} />
    </points>
  </group>;
}
