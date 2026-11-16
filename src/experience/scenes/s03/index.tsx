'use client';

import { PlaceholderScene } from '../PlaceholderScene';
import { scene } from './scene';
import type { Ctx, SceneId } from '../../contracts';

export default function Scene({ register }: { register: (id: SceneId, ctx: Ctx | null) => void }) {
  return <PlaceholderScene definition={scene} color="#426b55" register={register} />;
}
