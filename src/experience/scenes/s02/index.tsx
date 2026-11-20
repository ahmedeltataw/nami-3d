'use client';

import { useCallback, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  DataTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PointLight,
  RGBAFormat,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  TorusGeometry,
  Vector3,
  type Object3D,
} from 'three';
import type { Ctx, SceneId } from '../../contracts';
import type { AssetResidency } from '../../assets/residency';
import { useExperienceStore } from '../../store';
import { ParticleField, type ParticleFieldHandle, type Point3 } from '../../shared/particles';
import { s02PortalData } from '../manifests';
import { useSceneKit, type SceneKitResources } from '../useSceneKit';
import { type S02Context, type S02Visual } from './scene';

const origin = (): Point3 => [0, 0, 0];
export function previewVisible(openAmount: number, reveal: number, cameraZ = 0) {
  return openAmount > 0 && reveal === 0 && cameraZ > -2;
}

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
  const field = useRef<ParticleFieldHandle>(null);
  const particles = useRef<Group>(null);
  const profile = useExperienceStore(state => state.profile);
  const active = useExperienceStore(state => state.scene === 's02');
  const camera = useThree(state => state.camera);
  const world = useThree(state => state.scene);
  const particleState = useMemo(() => ({ progress: 0, time: 0 }), []);

  const onMount = useCallback((kit: Group, _extras: unknown[], { parent, ownedMaterials, ownedGeometries, ownedTextures, addObject }: SceneKitResources) => {
    const data = new Uint8Array(64 * 64 * 4);
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const i = (y * 64 + x) * 4;
        const radius = Math.hypot((x - 31.5) / 31.5, (y - 31.5) / 31.5);
        data[i] = 120;
        data[i + 1] = 255;
        data[i + 2] = 190;
        data[i + 3] = Math.round(255 * Math.max(0, 1 - radius) ** 2);
      }
    }
    const glow = new DataTexture(data, 64, 64, RGBAFormat);
    glow.needsUpdate = true;
    ownedTextures.push(glow);

    const spriteMaterial = new SpriteMaterial({
      map: glow,
      transparent: true,
      blending: AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const sphere = new Sprite(spriteMaterial);
    const greenLight = new PointLight('#009F6F', 0, 4);
    const ringGeometry = new TorusGeometry(0.28, 0.008, 8, 80);
    const ringMaterial = new MeshBasicMaterial({
      color: '#71ffb8',
      toneMapped: false,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const ring1 = new Mesh(ringGeometry, ringMaterial);
    const ring2 = new Mesh(ringGeometry, ringMaterial);
    ring2.rotation.x = Math.PI / 2.5;

    const energy = new Group();
    energy.name = 'S02_EnergyOrb';
    energy.add(sphere, greenLight, ring1, ring2);

    const flashGeometry = new PlaneGeometry(2, 2);
    const flashMaterial = new ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: { uBrightness: { value: 0 } },
      vertexShader: 'void main(){gl_Position=vec4(position.xy,0.0,1.0);}',
      fragmentShader: 'uniform float uBrightness; void main(){gl_FragColor=vec4(0.88,1.0,0.93,uBrightness);}',
    });
    const flash = new Mesh(flashGeometry, flashMaterial);
    flash.frustumCulled = false;
    flash.renderOrder = 999;

    ownedGeometries.push(ringGeometry, flashGeometry);
    ownedMaterials.push(spriteMaterial, ringMaterial, flashMaterial);
    addObject(energy);
    addObject(flash);

    const portalTarget = new Vector3(...s02PortalData.centre_gltf);
    const coreRing = kit.getObjectByName('S02_portal_core_ring');
    const portalGlow = kit.getObjectByName('S02_portal_glow');
    const labView = kit.getObjectByName(s02PortalData.lab_view);
    const tunnels = s02PortalData.tunnel.map(name => kit.getObjectByName(name)).filter(Boolean) as Object3D[];
    const swirls = [0, 1, 2].map(i => kit.getObjectByName(`S02_fx_swirl_${i}`)).filter(Boolean) as Object3D[];

    const left = new Vector3();
    const right = new Vector3();
    const midpoint = new Vector3();

    const context: S02Context = {
      root: parent,
      ambient: 0,
      reducedMotion: profile.motion === 'reduced',
      update(snapshot) {
        const v = snapshot.visual as S02Visual;
        const robot = world.getObjectByName('robot');
        let leftHand: Object3D | undefined;
        let rightHand: Object3D | undefined;
        if (robot) {
          robot.updateWorldMatrix(true, true);
          leftHand = robot.getObjectByName('LeftHand_Anchor');
          rightHand = robot.getObjectByName('RightHand_Anchor');
        }
        if (leftHand && rightHand) {
          leftHand.getWorldPosition(left);
          rightHand.getWorldPosition(right);
          midpoint.copy(left).add(right).multiplyScalar(0.5);
        } else {
          midpoint.set(v.robotPosition[0], v.robotPosition[1] + 0.6, v.robotPosition[2] + 0.4);
        }

        energy.position.copy(midpoint).lerp(portalTarget, v.morph);
        energy.visible = !v.reduced && v.reveal === 0;
        const chargeScale = Math.max(v.sphere, v.progress < 0.35 ? 0.35 + v.converge * 0.45 : 0);
        sphere.scale.setScalar(chargeScale * (1 - v.morph));
        spriteMaterial.opacity = 1 - v.morph;
        greenLight.intensity = chargeScale * (1 - v.reveal) * 4;
        ring1.scale.setScalar(chargeScale * (1 + v.morph * 2.2));
        ring2.scale.copy(ring1.scale);
        ring1.rotation.z = v.surfaceTime * 0.8;
        ring2.rotation.z = -v.surfaceTime;
        ringMaterial.opacity = 1 - v.morph;

        if (particles.current) {
          particles.current.position.copy(midpoint);
          particles.current.visible = !v.reduced && v.progress < 0.35;
        }
        particleState.progress = v.converge;
        particleState.time = v.surfaceTime;
        if (field.current) {
          field.current.material.uniforms.uProgress.value = v.converge;
          field.current.material.uniforms.uOpacity.value = 0.65 * (1 - v.sphere);
        }

        if (coreRing && !v.reduced) coreRing.rotation.z = v.outerAngle;
        for (let i = 0; i < tunnels.length; i++) {
          if (!v.reduced) tunnels[i].rotation.z = (i % 2 === 0 ? v.outerAngle : v.innerAngle) * 0.25;
        }
        for (let i = 0; i < swirls.length; i++) {
          if (!v.reduced) swirls[i].rotation.z = v.surfaceTime * (i % 2 === 0 ? 0.35 : -0.35);
        }
        if (portalGlow) portalGlow.visible = v.openAmount > 0 || v.assembleProgress > 0;
        if (labView) labView.visible = previewVisible(v.openAmount, v.reveal, camera.position.z);

        flash.visible = v.brightness > 0;
        flashMaterial.uniforms.uBrightness.value = v.brightness;
      },
    };

    return { ctx: context };
  }, [camera, particleState, profile.motion, world]);

  useSceneKit({
    sceneId: 's02',
    root,
    residency,
    register,
    onError,
    enabled: profile.renderer !== 'fallback',
    deps: [profile.motion, camera, world],
    onMount,
  });

  return <group ref={root} name="s02" visible={false} dispose={null}>
    <group ref={particles}><ParticleField ref={field} profile={profile} active={active && profile.motion === 'full'} preset="converge" targetFn={origin} state={particleState} /></group>
  </group>;
}
