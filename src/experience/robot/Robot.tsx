'use client';

/* eslint-disable react-hooks/immutability -- Three objects and runtime are imperative, outside React state. */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Plane, Raycaster, Vector2, Vector3 } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Profile, RobotDirective } from '../contracts';
import type { ExperienceRuntime } from '../runtime';
import { robotAssetKey } from '../assets/manifest';
import type { AssetLease, AssetResidency } from '../assets/residency';
import { RobotComposer, type PoseLayers } from './compose';
import { narrativeState, RobotFSM } from './fsm';
import { sampleIntro, type IntroDirective } from './intro';

export function Robot({ runtime, profile, residency, onError }: {
  runtime: ExperienceRuntime; profile: Profile; residency: AssetResidency; onError: () => void;
}) {
  const mounted = useRef<Group>(null);
  const aspect = useThree(state => state.size.width / Math.max(1, state.size.height));
  const scale = 0.52 * Math.min(1, aspect / 0.85);
  const composer = useMemo(() => new RobotComposer(), []);
  const fsm = useMemo(() => new RobotFSM(), []);
  const active = useRef<{ lease: AssetLease; key: ReturnType<typeof robotAssetKey>; residency: AssetResidency } | null>(null);
  const frame = useMemo(() => ({
    ray: new Raycaster(), pointer: new Vector2(), target: new Vector3(), discover: new Vector3(), plane: new Plane(new Vector3(0, 0, 1), -1.5),
    layers: { time: 0, delta: 0, reduced: false, canLook: false, target: null, reaction: null } as PoseLayers,
    intro: { kind: 'clip', name: 'Sleep', timeSeconds: 0, weight: 1 } as IntroDirective,
    seekVersion: -1, reaction: null as ExperienceRuntime['interaction']['state']['reaction'],
  }), []);

  useEffect(() => {
    const key = robotAssetKey(profile.quality);
    const lease = residency.acquire(key);
    let cancelled = false;
    let installed = false;
    void lease.ready.then(asset => {
      if (cancelled || !mounted.current) return;
      const gltf = asset.value as GLTF;
      const object = gltf.scene.clone(true);
      composer.bind(object, gltf.animations);
      mounted.current.clear();
      mounted.current.add(object);
      const previous = active.current;
      active.current = { lease, key, residency };
      installed = true;
      previous?.lease.release();
      if (previous && (previous.key !== key || previous.residency !== residency)) previous.residency.evict(previous.key);
      runtime.robotReady = true;
    }).catch(error => { if (!cancelled && error instanceof Error && error.name !== 'AbortError') onError(); });
    return () => { cancelled = true; if (!installed) lease.release(); };
  }, [composer, onError, profile.quality, residency, runtime]);

  useEffect(() => () => {
    runtime.robotReady = false;
    composer.dispose();
    active.current?.lease.release();
    if (active.current) active.current.residency.evict(active.current.key);
    active.current = null;
  }, [composer, runtime]);

  useFrame((state, delta) => {
    if (!runtime.snapshot || !runtime.assetsReady || !runtime.robotReady || runtime.contextLost) return;
    if (mounted.current) {
      if (runtime.scene === 's03') {
        frame.discover.set(-1.2, -0.8, -3.3).applyQuaternion(state.camera.quaternion).add(state.camera.position);
        mounted.current.position.copy(frame.discover);
        mounted.current.quaternion.copy(state.camera.quaternion);
      } else {
        mounted.current.position.set(0, -1.69 * scale, 0);
        mounted.current.quaternion.identity();
      }
    }
    const now = state.clock.elapsedTime;
    if (runtime.seekVersion !== frame.seekVersion) {
      frame.seekVersion = runtime.seekVersion;
      fsm.seek(runtime.snapshot);
      composer.resetGaze();
    } else fsm.observe(runtime.snapshot);
    let directive: RobotDirective = runtime.snapshot.robot;
    let discoverSeconds = -1;
    if (!runtime.introCancelled && runtime.scene === 's01' && profile.motion === 'full') {
      if (runtime.introStartedAt < 0) runtime.introStartedAt = now;
      const elapsed = now - runtime.introStartedAt;
      if (elapsed >= 1.2 && elapsed < 1.8) discoverSeconds = elapsed - 1.2;
      directive = sampleIntro(elapsed, frame.intro);
      runtime.snapshot.robot = directive;
      fsm.setState(directive.name === 'WakeUp' ? 'waking' : directive.name === 'Wave' ? 'performing' : 'interacting');
      if (elapsed >= 4.6) runtime.introCancelled = true;
    } else fsm.setState(narrativeState(runtime.snapshot));
    const reaction = runtime.interaction.state.reaction;
    if (reaction !== frame.reaction) {
      frame.reaction = reaction;
      if (reaction && (reaction.name === 'nod' || reaction.name === 'tilt')) fsm.react(reaction.name, reaction.startedAt, reaction.duration);
      else fsm.reaction = null;
    }
    fsm.tick(now);
    frame.pointer.set(runtime.pointer.x, runtime.pointer.y);
    frame.ray.setFromCamera(frame.pointer, state.camera);
    const cursorTarget = frame.ray.ray.intersectPlane(frame.plane, frame.target);
    if (cursorTarget && discoverSeconds >= 0) {
      frame.discover.set(0.8 * Math.sin(discoverSeconds / 0.6 * Math.PI * 2), 0.5, 1.5);
      cursorTarget.lerp(frame.discover, 1 - discoverSeconds / 0.6);
    }
    const layers = frame.layers;
    layers.time = now;
    layers.delta = delta;
    layers.reduced = profile.motion === 'reduced';
    layers.canLook = fsm.canLook;
    layers.target = runtime.taskGaze ?? (runtime.scene === 's01' ? cursorTarget : null);
    layers.reaction = fsm.reaction;
    composer.compose(directive, layers);
  });

  // Manifest height 3.38: 0.52 gives a 1.76-unit silhouette inside the 35° front camera.
  return <group name="robot" position={[0, -1.69 * scale, 0]} scale={scale} ref={mounted} dispose={null} />;
}
