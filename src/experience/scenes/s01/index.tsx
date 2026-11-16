'use client';

import { useEffect, useMemo, useRef } from 'react';
import { DataTexture, RGBAFormat, type Group } from 'three';
import type { Ctx, SceneId } from '../../contracts';

export default function Scene({ register }: { register: (id: SceneId, ctx: Ctx | null) => void }) {
  const root = useRef<Group>(null);
  const motes = useMemo(() => Float32Array.from(Array.from({ length: 18 }, (_, i) => [
    Math.sin(i * 2.4) * 2.2, Math.cos(i * 1.7) * 1.4, -0.8 - (i % 5) * 0.3,
  ]).flat()), []);
  const shadow = useMemo(() => {
    const size = 64;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 4;
      const radius = Math.hypot((x - 31.5) / 31.5, (y - 31.5) / 31.5);
      data[offset] = data[offset + 1] = data[offset + 2] = 27;
      data[offset + 3] = Math.round(28 * Math.max(0, 1 - radius) ** 2);
    }
    const texture = new DataTexture(data, size, size, RGBAFormat);
    texture.needsUpdate = true;
    return texture;
  }, []);
  useEffect(() => {
    if (root.current) register('s01', { root: root.current, ambient: 0, reducedMotion: false });
    return () => { register('s01', null); };
  }, [register]);
  useEffect(() => () => shadow.dispose(), [shadow]);
  return <group ref={root} name="s01" visible={false}>
    <directionalLight position={[-3, 4, 5]} intensity={1.1} />
    <directionalLight position={[3, 1, 3]} intensity={0.5} />
    <mesh position={[0, -0.98, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[2, 1.25]} />
      <meshBasicMaterial map={shadow} transparent depthWrite={false} />
    </mesh>
    <points name="s01-motes">
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[motes, 3]} /></bufferGeometry>
      <pointsMaterial color="#009f6f" size={0.018} transparent opacity={0.22} depthWrite={false} />
    </points>
  </group>;
}
