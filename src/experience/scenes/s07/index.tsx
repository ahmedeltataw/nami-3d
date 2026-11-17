'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Group, type Material } from 'three';
import { useFrame } from '@react-three/fiber';
import type { Ctx, SceneId } from '../../contracts';
import type { AssetResidency } from '../../assets/residency';
import { useExperienceStore } from '../../store';
import { createChoiceStateMachine, type ChoiceId } from './state';
import { gsap } from 'gsap';
import { ambientAngle } from '../../ambient';
import { useMotionRuntime } from '../../RuntimeContext';

export default function S07Scene({
  register,
}: {
  register: (id: SceneId, ctx: Ctx | null) => void;
  residency?: AssetResidency | null;
  onError?: () => void;
}) {
  const runtime = useMotionRuntime();
  const root = useRef<Group>(null);
  const coreRef = useRef<Group>(null);
  const shapesRef = useRef<Group>(null);

  const websiteRef = useRef<Group>(null);
  const mobileRef = useRef<Group>(null);
  const marketingRef = useRef<Group>(null);
  const otherRef = useRef<Group>(null);

  const stateMachine = useMemo(() => createChoiceStateMachine(), []);
  const choice = useExperienceStore(state => state.projectType);
  const motion = useExperienceStore(state => state.profile.motion);
  const proxy = useMemo(() => ({ progress: 0 }), []);
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      if (choice && ['website', 'mobile', 'marketing', 'other'].includes(choice)) {
        stateMachine.select(choice as ChoiceId, 0);
        proxy.progress = 0;
        gsap.to(proxy, { progress: 1, duration: motion === 'reduced' ? 0 : .9, ease: 'none' });
      } else { stateMachine.reset(); proxy.progress = 0; }
    });
    return () => ctx.revert();
  }, [choice, motion, proxy, stateMachine]);

  useEffect(() => {
    if (!root.current) return;
    const parent = root.current;
    register('s07', { root: parent, ambient: 0, reducedMotion: false });
    return () => {
      register('s07', null);
      parent.clear();
    };
  }, [register]);

  useFrame(() => {
    const reduced = useExperienceStore.getState().profile.motion === 'reduced';
    const now = runtime?.clocks.value.ambientTime ?? 0;
    const visual = stateMachine.sample(proxy.progress * .9);

    // Apply to Energy Core
    if (coreRef.current) {
      coreRef.current.visible = visual.coreOpacity > 0.001;
      coreRef.current.scale.setScalar(visual.coreScale * Number(runtime?.sceneSnapshots.s07?.visual.coreAppearance ?? 1));
      coreRef.current.traverse((node) => {
        if ('isMesh' in node && node.isMesh && 'material' in node && node.material) {
          const mat = node.material as Material;
          mat.transparent = true;
          mat.opacity = visual.coreOpacity;
        }
      });
    }

    // Apply to Shapes
    const target = stateMachine.getState().targetChoice;
    const shapeRefs: Record<ChoiceId, React.RefObject<Group | null>> = {
      website: websiteRef,
      mobile: mobileRef,
      marketing: marketingRef,
      other: otherRef,
    };

    for (const [key, ref] of Object.entries(shapeRefs)) {
      if (ref.current) {
        const isTarget = target === key;
        ref.current.visible = isTarget && visual.shapeOpacity > 0.001;
        if (isTarget) {
          ref.current.scale.setScalar(visual.shapeScale);
          ref.current.rotation.y = reduced ? 0 : ambientAngle(now, .8, runtime?.ambientWeight ?? 1);
          ref.current.traverse((node) => {
            if ('isMesh' in node && node.isMesh && 'material' in node && node.material) {
              const mat = node.material as Material;
              mat.transparent = true;
              mat.opacity = visual.shapeOpacity;
            }
          });
        }
      }
    }
  });

  return (
    <group ref={root} name="s07" visible={false} dispose={null}>
      <directionalLight position={[0, 4, 4]} intensity={1.8} />
      <directionalLight position={[3, 1, 2]} intensity={0.8} />

      {/* Floating glowing energy core between robot's hands */}
      <group ref={coreRef} name="S07_EnergyCore" position={[0, -0.15, 0.75]}>
        {/* Core sphere */}
        <mesh>
          <icosahedronGeometry args={[0.22, 2]} />
          <meshStandardMaterial
            color="#009f6f"
            emissive="#009f6f"
            emissiveIntensity={1.8}
            roughness={0.2}
            metalness={0.3}
          />
        </mesh>

        {/* Outer glowing halo */}
        <mesh>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshBasicMaterial color="#11b14e" wireframe transparent opacity={0.4} />
        </mesh>

        {/* Orbiting rings */}
        <mesh rotation={[Math.PI / 4, 0, 0]}>
          <ringGeometry args={[0.35, 0.38, 32]} />
          <meshBasicMaterial color="#f9b233" transparent opacity={0.6} side={2} />
        </mesh>
      </group>

      {/* Interactive transformed project shapes */}
      <group ref={shapesRef} name="S07_Shapes" position={[0, -0.1, 0.75]}>
        {/* 1. Website: 3D desktop browser display */}
        <group ref={websiteRef} visible={false}>
          {/* Monitor frame */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.7, 0.45, 0.04]} />
            <meshStandardMaterial color="#1e293b" roughness={0.3} />
          </mesh>
          {/* Screen with glowing accent */}
          <mesh position={[0, 0, 0.025]}>
            <planeGeometry args={[0.64, 0.39]} />
            <meshStandardMaterial color="#009f6f" emissive="#009f6f" emissiveIntensity={0.6} />
          </mesh>
          {/* Browser top bar */}
          <mesh position={[0, 0.16, 0.028]}>
            <planeGeometry args={[0.62, 0.04]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
        </group>

        {/* 2. Mobile: 3D phone kit */}
        <group ref={mobileRef} visible={false}>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.3, 0.58, 0.035]} />
            <meshStandardMaterial color="#0f172a" roughness={0.2} metalness={0.8} />
          </mesh>
          <mesh position={[0, 0, 0.02]}>
            <planeGeometry args={[0.26, 0.52]} />
            <meshStandardMaterial color="#009f6f" emissive="#009f6f" emissiveIntensity={0.8} />
          </mesh>
        </group>

        {/* 3. Marketing: 3D ascending growth bars */}
        <group ref={marketingRef} visible={false}>
          <mesh position={[-0.2, -0.1, 0]}>
            <boxGeometry args={[0.1, 0.22, 0.1]} />
            <meshStandardMaterial color="#0d7f57" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.1, 0.42, 0.1]} />
            <meshStandardMaterial color="#009f6f" emissive="#009f6f" emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[0.2, 0.12, 0]}>
            <boxGeometry args={[0.1, 0.65, 0.1]} />
            <meshStandardMaterial color="#11b14e" emissive="#11b14e" emissiveIntensity={0.8} />
          </mesh>
        </group>

        {/* 4. Other: 3D geometric polyhedron / tech cluster */}
        <group ref={otherRef} visible={false}>
          <mesh>
            <octahedronGeometry args={[0.28, 0]} />
            <meshStandardMaterial color="#f9b233" emissive="#f9b233" emissiveIntensity={0.5} roughness={0.2} />
          </mesh>
          <mesh rotation={[Math.PI / 3, Math.PI / 4, 0]}>
            <torusGeometry args={[0.38, 0.02, 16, 48]} />
            <meshStandardMaterial color="#009f6f" emissive="#009f6f" emissiveIntensity={0.6} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
