'use client';

import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, type Group } from 'three';
import type { Ctx, SceneDef } from '../contracts';

export function PlaceholderScene({ definition, color, register }: {
  definition: SceneDef;
  color: string;
  register: (id: SceneDef['id'], ctx: Ctx | null) => void;
}) {
  const root = useRef<Group>(null);
  const label = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const context = canvas.getContext('2d');
    if (context) {
      context.font = 'bold 64px sans-serif';
      context.fillStyle = '#183d49';
      context.textAlign = 'center';
      context.fillText(definition.id, 128, 88);
    }
    return new CanvasTexture(canvas);
  }, [definition.id]);
  useEffect(() => {
    if (root.current) register(definition.id, { root: root.current, ambient: 0, reducedMotion: false });
    return () => { register(definition.id, null); label.dispose(); };
  }, [definition.id, register, label]);
  return <group ref={root} name={definition.id} visible={false}>
    <mesh><boxGeometry args={[1.5, 1.5, 1.5]} /><meshStandardMaterial color={color} /></mesh>
    <sprite position={[0, 1.25, 0]} scale={[1.6, 0.8, 1]}><spriteMaterial map={label} depthTest={false} /></sprite>
  </group>;
}
