'use client';

/* eslint-disable react-hooks/immutability -- Three.js objects and uniforms are imperative. */
import { useCallback, useMemo, useRef } from 'react';
import { Group, Mesh, Object3D } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Ctx, SceneId } from '../../contracts';
import type { AssetResidency } from '../../assets/residency';
import { useExperienceStore } from '../../store';
import { ParticleField, type ParticleFieldHandle } from '../../shared/particles/ParticleField';
import { PARTICLE_COUNTS } from '../../shared/particles/core';
import { sampleMeshSurface } from '../../shared/particles/sampleMeshSurface';
import type { ParticleFrame } from '../../shared/particles/motion';
import { generateValueTargets, VALUES_COUNT } from './math';
import type { S06Visual } from './scene';
import { useFrame } from '@react-three/fiber';
import { useMotionRuntime } from '../../RuntimeContext';
import { s06DnaData } from '../manifests';
import { useSceneKit, type SceneKitResources } from '../useSceneKit';

export default function S06Scene({
  register,
  residency,
  onError,
}: {
  register: (id: SceneId, ctx: Ctx | null) => void;
  residency?: AssetResidency | null;
  onError?: () => void;
}) {
  const runtime = useMotionRuntime();
  const root = useRef<Group>(null);
  const particleRef = useRef<ParticleFieldHandle>(null);
  const profile = useExperienceStore(state => state.profile);

  const particleCount = PARTICLE_COUNTS[profile.quality];

  const valueTargets = useMemo(() => {
    const map = new Map<number, Float32Array>();
    for (let i = 0; i < VALUES_COUNT; i++) {
      map.set(i, generateValueTargets(i, particleCount, 42));
    }
    return map;
  }, [particleCount]);

  const logoTargetsRef = useRef<Float32Array | null>(null);
  const lastTargetModeRef = useRef<string>('');
  const particleFrame = useMemo<ParticleFrame>(() => ({ progress: 0, time: 0 }), []);

  const onMount = useCallback((kit: Group, extras: GLTF[], { parent, ownedMaterials, addObject }: SceneKitResources) => {
    const stage = kit.getObjectByName(s06DnaData.stage.node);
    if (stage && Math.abs(stage.scale.x - s06DnaData.stage.scale) > 1e-4) {
      stage.scale.setScalar(s06DnaData.stage.scale);
    }

    const targetAnchor = new Object3D();
    targetAnchor.name = 'S06_ValueTarget';
    const initialAnchor = s06DnaData.helix.value_pill_anchors_gltf[0];
    targetAnchor.position.set(initialAnchor[0], initialAnchor[1], initialAnchor[2]);
    addObject(targetAnchor);

    const logoScene = extras[0].scene.clone(true);
    logoScene.name = 'S06_Logo';
    logoScene.position.set(0, 0.2, 0);
    logoScene.scale.setScalar(0.72);
    logoScene.visible = false;

    const proxy = logoScene.getObjectByName('LogoProxy') as Mesh | undefined;
    if (proxy) {
      proxy.visible = false;
      try {
        logoTargetsRef.current = sampleMeshSurface(proxy.geometry, particleCount, 42);
      } catch {
        logoTargetsRef.current = valueTargets.get(6) ?? null;
      }
    }

    logoScene.traverse(node => {
      if ('isMesh' in node && node.isMesh && 'material' in node && node.material) {
        const mesh = node as Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(m => {
            const copy = m.clone();
            copy.transparent = true;
            copy.opacity = 0;
            ownedMaterials.push(copy);
            return copy;
          });
        } else {
          const copy = mesh.material.clone();
          copy.transparent = true;
          copy.opacity = 0;
          ownedMaterials.push(copy);
          mesh.material = copy;
        }
      }
    });

    addObject(logoScene);
    return { ctx: { root: parent, ambient: 0, reducedMotion: false } };
  }, [particleCount, valueTargets]);

  useSceneKit({
    sceneId: 's06',
    root,
    residency,
    register,
    onError,
    registerWithoutResidency: true,
    extraKeys: ['logo.3d'],
    deps: [particleCount, valueTargets],
    onMount,
  });

  useFrame(() => {
    if (!particleRef.current || profile.renderer === 'fallback') return;

    const controllerState = useExperienceStore.getState();
    if (controllerState.scene !== 's06') return;
    const visual = (controllerState as unknown as { s06Visual?: S06Visual }).s06Visual;
    const mode = visual?.particleMode ?? 'ambient';
    const convergeProg = visual?.convergeProgress ?? 0;
    const particleOpacity = visual?.particleOpacity ?? 1;

    if (mode !== lastTargetModeRef.current) {
      lastTargetModeRef.current = mode;
      if (mode === 'ambient') {
        particleRef.current.setPreset('ambient');
      } else if (mode.startsWith('value_')) {
        const valIdx = parseInt(mode.replace('value_', ''), 10);
        const targets = valueTargets.get(valIdx);
        if (targets) {
          particleRef.current.setTargets(targets);
          particleRef.current.setPreset('converge');
        }
      } else if (mode === 'logo') {
        const targets = logoTargetsRef.current ?? valueTargets.get(6);
        if (targets) {
          particleRef.current.setTargets(targets);
          particleRef.current.setPreset('converge');
        }
      }
    }

    particleFrame.progress = convergeProg;
    particleFrame.time = runtime?.clocks.value.ambientTime ?? 0;
    if (particleRef.current.material?.uniforms?.uOpacity) {
      particleRef.current.material.uniforms.uOpacity.value = 0.65 * particleOpacity;
    }
  });

  return (
    <group ref={root} name="s06" visible={false} dispose={null}>
      <directionalLight position={[2, 3, 4]} intensity={1.5} />
      <directionalLight position={[-2, 1, 2]} intensity={0.6} />
      <ParticleField
        profile={profile}
        seed={42}
        preset="ambient"
        state={particleFrame}
        ref={particleRef}
      />
    </group>
  );
}
