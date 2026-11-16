'use client';

import { useEffect, useRef } from 'react';
import type { Group } from 'three';
import type { Ctx, SceneDef } from '../contracts';

export function PlaceholderScene({ definition, register }: {
  definition: SceneDef;
  color: string;
  register: (id: SceneDef['id'], ctx: Ctx | null) => void;
}) {
  const root = useRef<Group>(null);
  useEffect(() => {
    if (root.current) register(definition.id, { root: root.current, ambient: 0, reducedMotion: false });
    return () => { register(definition.id, null); };
  }, [definition.id, register]);
  return <group ref={root} name={definition.id} visible={false} />;
}
