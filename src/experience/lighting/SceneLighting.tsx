'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { SceneId } from '../contracts';
import { useMotionRuntime } from '../RuntimeContext';
import { LightingController } from './controller';
import { LightingPost } from './post';

export function SceneLighting({ scene, lighting, post: postRef }: { scene: SceneId; lighting: LightingController; post: RefObject<LightingPost | null> }) {
  const runtime = useMotionRuntime();
  const state = useThree();
  const resources = useRef<{ lighting: LightingController; post: LightingPost } | null>(null);
  useEffect(() => {
    const post = new LightingPost(state.gl, state.scene, state.camera);
    postRef.current = post;
    resources.current = { lighting, post };
    state.scene.add(lighting.root);
    return () => { lighting.dispose(); post.dispose(); state.scene.fog = null; resources.current = null; postRef.current = null; };
  }, [lighting, postRef, state.gl, state.scene, state.camera]);
  useFrame(() => {
    if (!resources.current) return;
    const owner = runtime?.transitionContext.intents?.owner ?? runtime?.scene ?? scene;
    const roots = [state.scene.getObjectByName(owner), state.scene.getObjectByName('robot')].filter(root => !!root);
    const transition = runtime?.transition;
    const intents = runtime?.transitionContext.intents;
    resources.current.lighting.update(runtime?.scene ?? scene, transition && intents ? { id: transition.id, owner: intents.owner, lights: intents.lights } : null, state.scene, roots);
  }, -.5);
  // Host applies scene presentation at priority 1; post owns the single final render.
  useFrame(() => {
    const resource = resources.current;
    if (resource && !runtime?.contextLost) resource.post.render(resource.lighting.post, state.size.width, state.size.height, state.gl.getPixelRatio());
  }, 2);
  return null;
}
