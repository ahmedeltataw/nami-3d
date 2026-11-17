'use client';

/* eslint-disable react-hooks/immutability -- Three objects and runtime are imperative, outside React state. */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Plane, Raycaster, Vector2, Vector3 } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Profile } from '../contracts';
import type { ExperienceRuntime } from '../runtime';
import { robotAssetKey } from '../assets/manifest';
import type { AssetLease, AssetResidency } from '../assets/residency';
import { RobotComposer, type PoseLayers } from './compose';
import { narrativeState, RobotFSM } from './fsm';
import { pointerNearHead } from './procedural';
import { robotPlacement } from './placement';

export function Robot({ runtime, profile, residency, onError }: {
  runtime: ExperienceRuntime; profile: Profile; residency: AssetResidency; onError: () => void;
}) {
  const mounted = useRef<Group>(null);
  const size = useThree(state => state.size);
  const aspect = size.width / Math.max(1, size.height);
  const scale = 0.52 * Math.min(1, aspect / 0.85);
  const composer = useMemo(() => new RobotComposer(), []);
  const fsm = useMemo(() => new RobotFSM(), []);
  const active = useRef<{ lease: AssetLease; key: ReturnType<typeof robotAssetKey>; residency: AssetResidency } | null>(null);
  const frame = useMemo(() => ({
    ray: new Raycaster(), pointer: new Vector2(), target: new Vector3(), discover: new Vector3(), head: new Vector3(), eye: new Vector3(), hand: new Vector3(), plane: new Plane(new Vector3(0, 0, 1), -1.5),
    layers: { time: 0, delta: 0, reduced: false, canLook: false, target: null, reaction: null } as PoseLayers,
    seekVersion: -1, reaction: null as ExperienceRuntime['interaction']['state']['reaction'],
  }), []);

  useEffect(() => {
    const key = robotAssetKey(profile.quality);
    const lease = residency.acquire(key);
    let cancelled = false;
    let installed = false;
    const choreography = residency.acquire('robot.choreography');
    void Promise.all([lease.ready, choreography.ready]).then(([asset, extra]) => {
      if (cancelled || !mounted.current) return;
      const gltf = asset.value as GLTF;
      const object = gltf.scene.clone(true);
      const additional = (extra.value as GLTF).animations.filter(clip => !gltf.animations.some(existing => existing.name === clip.name));
      composer.bind(object, [...gltf.animations, ...additional]);
      mounted.current.clear();
      mounted.current.add(object);
      const previous = active.current;
      active.current = { lease, key, residency };
      installed = true;
      previous?.lease.release();
      if (previous && (previous.key !== key || previous.residency !== residency)) previous.residency.evict(previous.key);
      runtime.robotReady = true;
      runtime.robotMeshes = 0;
      object.traverse(node => { if ('isMesh' in node && node.isMesh) runtime.robotMeshes++; });
    }).catch(error => { if (!cancelled && error instanceof Error && error.name !== 'AbortError') onError(); });
    return () => { cancelled = true; choreography.release(); if (!installed) lease.release(); };
  }, [composer, onError, profile.quality, residency, runtime]);

  useEffect(() => () => {
    runtime.robotReady = false;
    composer.dispose();
    active.current?.lease.release();
    if (active.current) active.current.residency.evict(active.current.key);
    active.current = null;
  }, [composer, runtime]);

  useFrame((state, delta) => {
    const snapshot = runtime.presentationSnapshot ?? runtime.snapshot;
    const scene = runtime.transition?.owner ?? runtime.scene;
    const transition = runtime.presentationSnapshot ? null : runtime.transitionContext.intents;
    if (!snapshot || !runtime.assetsReady || !runtime.robotReady || runtime.contextLost) return;
    const now = state.clock.elapsedTime;
    if (runtime.seekVersion !== frame.seekVersion) {
      frame.seekVersion = runtime.seekVersion;
      fsm.seek(snapshot);
      composer.resetGaze();
    } else if (runtime.intro.cancelled || scene !== 's01') fsm.observe(snapshot);
    const robotIntent = transition?.robot;
    const directive = transition?.robotPose.clipA ?? robotIntent?.directive ?? snapshot.robot;
    fsm.setState(narrativeState(snapshot));
    const reaction = runtime.interaction.state.reaction;
    if (reaction !== frame.reaction) {
      frame.reaction = reaction;
      if (reaction && (reaction.name === 'nod' || reaction.name === 'tilt' || reaction.name === 'React')) fsm.react(reaction.name, reaction.startedAt, reaction.duration);
      else fsm.reaction = null;
    }
    fsm.tick(now);
    frame.pointer.set(runtime.pointer.x, runtime.pointer.y);
    frame.ray.setFromCamera(frame.pointer, state.camera);
    const cursorTarget = frame.ray.ray.intersectPlane(frame.plane, frame.target);
    const s01 = scene === 's01';
    const visual = snapshot.visual;
    if (mounted.current) {
      const placement = robotPlacement(scene, snapshot, runtime.viewport);
      mounted.current.position.fromArray(robotIntent?.position ?? placement.position);
      mounted.current.quaternion.fromArray(robotIntent?.quaternion ?? placement.quaternion);
    }
    const layers = frame.layers;
    layers.time = now;
    layers.ambientTime = runtime.clocks.value.ambientTime;
    layers.ambientWeight = runtime.ambientWeight * Number(fsm.canLook);
    layers.transitionPose = transition?.robotPose;
    layers.delta = delta;
    layers.reduced = profile.motion === 'reduced';
    layers.canLook = !runtime.transition && !runtime.clocks.capture && (fsm.canLook || (s01 && visual.discover === true));
    layers.target = runtime.taskGaze ?? ((s01 || scene === 's05') && runtime.pointer.active ? cursorTarget : null);
    layers.reaction = runtime.transition || runtime.clocks.capture ? null : fsm.reaction;
    layers.headPitch = s01 && typeof visual.headPitch === 'number' ? visual.headPitch : undefined;
    layers.eyeOpen = s01 ? Number(visual.eyeOpen ?? 1) : undefined;
    layers.focus = s01 ? Number(visual.focus ?? 0) : 0;
    layers.headNear = s01 && runtime.pointer.active && pointerNearHead((runtime.pointer.x + 1) * state.size.width / 2, (1 - runtime.pointer.y) * state.size.height / 2, runtime.headScreen);
    if (runtime.clocks.capture) composer.resetGaze();
    composer.compose(directive, layers);
    composer.materialLayer(transition?.dissolve ?? 0);
    if (mounted.current) mounted.current.visible = (transition?.dissolve ?? 0) < 1;
    const head = runtime.headScreen;
    head.visible = s01 && composer.worldPosition('Eye_L', frame.head) && composer.worldPosition('Eye_R', frame.eye);
    if (head.visible) {
      frame.head.project(state.camera);
      frame.eye.project(state.camera);
      head.x = (1 + (frame.head.x + frame.eye.x) / 2) * state.size.width / 2;
      head.y = (1 - (frame.head.y + frame.eye.y) / 2) * state.size.height / 2;
      head.radius = Math.max(30, Math.abs(frame.head.x - frame.eye.x) * state.size.width * 0.6);
      head.visible = frame.head.z > -1 && frame.head.z < 1;
    }
    if (composer.worldPosition('RightHand_Anchor', frame.hand)) {
      frame.hand.project(state.camera);
      runtime.handScreen.x = (frame.hand.x + 1) * state.size.width / 2;
      runtime.handScreen.y = (1 - frame.hand.y) * state.size.height / 2;
    }
  });

  // Manifest height 3.38: 0.52 gives a 1.76-unit silhouette inside the 35° front camera.
  return <group name="robot" scale={scale} ref={mounted} dispose={null} />;
}
