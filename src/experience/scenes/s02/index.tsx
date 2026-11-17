'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { AdditiveBlending, AmbientLight, Color, DataTexture, DirectionalLight, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, PointLight, RGBAFormat, Scene as ThreeScene, ShaderMaterial, Sprite, SpriteMaterial, TorusGeometry, Vector3, WebGLRenderTarget, type Object3D } from 'three';
import type { Ctx, SceneId } from '../../contracts';
import type { AssetResidency } from '../../assets/residency';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { useExperienceStore } from '../../store';
import { ParticleField, type ParticleFieldHandle, type Point3 } from '../../shared/particles';
import { bindPortal, type PortalState } from '../../shared/portal/Portal';
import { scene as lab } from '../s03/scene';
import { type S02Context, type S02Visual } from './scene';

const origin = (): Point3 => [0, 0, 0];
export function previewVisible(openAmount: number, reveal: number, cameraZ = 2.6) {
  return openAmount > 0 && reveal === 0 && cameraZ > -2;
}

export default function Scene({ register, residency, onError }: { register: (id: SceneId, ctx: Ctx | null) => void; residency: AssetResidency | null; onError: () => void }) {
  const root = useRef<Group>(null);
  const field = useRef<ParticleFieldHandle>(null);
  const particles = useRef<Group>(null);
  const profile = useExperienceStore(state => state.profile);
  const active = useExperienceStore(state => state.scene === 's02');
  const gl = useThree(state => state.gl);
  const camera = useThree(state => state.camera);
  const world = useThree(state => state.scene);
  const particleState = useMemo(() => ({ progress: 0, time: 0 }), []);

  useEffect(() => {
    if (!residency || !root.current || profile.renderer === 'fallback') return;
    const parent = root.current;
    const cancel = new AbortController();
    const leases = ['portal.gate', 'lab.shell'].map(key => residency.acquire(key as 'portal.gate' | 'lab.shell', cancel.signal));
    let dispose: (() => void) | undefined;
    void Promise.all(leases.map(lease => lease.ready)).then(assets => {
      if (cancel.signal.aborted) return;
      const [gate, shell] = assets.map(asset => asset.value as GLTF);
      const portal = bindPortal(gate.scene);
      const gateMount = new Group();
      gateMount.position.set(0, 0, -2);
      gateMount.scale.setScalar(.54);
      gateMount.add(portal.root);
      const preview = new ThreeScene();
      preview.background = new Color('#1B1D20');
      preview.add(shell.scene, new AmbientLight('#ffffff', 1.6));
      const light = new DirectionalLight('#b4ffdd', 3);
      light.position.set(3, 8, 5); preview.add(light);
      const pose = lab.sample({ local: 0, viewport: { w: 1280, h: 800, dpr: 1 }, profile,
        seed: 1, ambient: 0, interaction: { source: null, token: 0, reaction: null } }).camera;
      const previewCamera = new PerspectiveCamera(pose.fov, 1, pose.near, pose.far);
      previewCamera.position.fromArray(pose.position); previewCamera.quaternion.fromArray(pose.quaternion);
      const target = new WebGLRenderTarget(1, 1, { depthBuffer: true });
      const state: PortalState = { assembleProgress: 0, ringSpeed: 0, openAmount: 0, surfaceTexture: target.texture, time: 0 };
      const data = new Uint8Array(64 * 64 * 4);
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const i = (y * 64 + x) * 4;
        const radius = Math.hypot((x - 31.5) / 31.5, (y - 31.5) / 31.5);
        data[i] = 120; data[i + 1] = 255; data[i + 2] = 190;
        data[i + 3] = Math.round(255 * Math.max(0, 1 - radius) ** 2);
      }
      const glow = new DataTexture(data, 64, 64, RGBAFormat); glow.needsUpdate = true;
      const spriteMaterial = new SpriteMaterial({ map: glow, transparent: true, blending: AdditiveBlending, depthTest: false, depthWrite: false, toneMapped: false });
      const sphere = new Sprite(spriteMaterial);
      const energy = new Group();
      const greenLight = new PointLight('#009F6F', 0, 4);
      const ringGeometry = new TorusGeometry(.28, .008, 8, 80);
      const ringMaterial = new MeshBasicMaterial({ color: '#71ffb8', toneMapped: false, transparent: true, depthTest: false, depthWrite: false });
      const ring1 = new Mesh(ringGeometry, ringMaterial);
      const ring2 = new Mesh(ringGeometry, ringMaterial);
      ring2.rotation.x = Math.PI / 2.5;
      energy.add(sphere, greenLight, ring1, ring2);
      const flashGeometry = new PlaneGeometry(2, 2);
      const flashMaterial = new ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false,
        uniforms: { uBrightness: { value: 0 } },
        vertexShader: 'void main(){gl_Position=vec4(position.xy,0.0,1.0);}',
        fragmentShader: 'uniform float uBrightness; void main(){gl_FragColor=vec4(0.88,1.0,0.93,uBrightness);}' });
      const flash = new Mesh(flashGeometry, flashMaterial); flash.frustumCulled = false; flash.renderOrder = 999;
      parent.add(gateMount, energy, flash);
      const left = new Vector3(); const right = new Vector3(); const midpoint = new Vector3();
      let robot: Object3D | undefined; let leftHand: Object3D | undefined; let rightHand: Object3D | undefined;
      let renderedSnapshot: unknown;
      const context: S02Context = { root: parent, ambient: 0, reducedMotion: profile.motion === 'reduced',
        update(snapshot) {
          const v = snapshot.visual as S02Visual;
          robot = world.getObjectByName('robot');
          if (robot) {
            robot.updateWorldMatrix(true, true);
            leftHand = robot.getObjectByName('LeftHand_Anchor'); rightHand = robot.getObjectByName('RightHand_Anchor');
          }
          if (leftHand && rightHand) {
            leftHand.getWorldPosition(left); rightHand.getWorldPosition(right);
            midpoint.copy(left).add(right).multiplyScalar(.5);
          } else midpoint.set(0, 0, .3);
          energy.position.copy(midpoint);
          energy.position.lerp(gateMount.position, v.morph);
          energy.visible = !v.reduced && v.reveal === 0;
          sphere.scale.setScalar(v.sphere * (1 - v.morph));
          spriteMaterial.opacity = 1 - v.morph;
          greenLight.intensity = v.sphere * (1 - v.reveal) * 4;
          ring1.scale.setScalar(v.sphere * (1 + v.morph * 2.2));
          ring2.scale.copy(ring1.scale);
          ring1.rotation.z = v.surfaceTime * .8;
          ring2.rotation.z = -v.surfaceTime;
          ringMaterial.opacity = 1 - v.morph;
          if (particles.current) {
            particles.current.position.copy(midpoint);
            particles.current.visible = !v.reduced && v.progress < .35;
          }
          particleState.progress = v.converge; particleState.time = v.surfaceTime;
          if (field.current) {
            field.current.material.uniforms.uProgress.value = v.converge;
            field.current.material.uniforms.uOpacity.value = .65 * (1 - v.sphere);
          }
          gateMount.visible = v.reveal === 0;
          state.assembleProgress = v.assembleProgress; state.ringSpeed = v.ringSpeed;
          state.openAmount = v.openAmount; state.time = v.surfaceTime; state.reduced = v.reduced;
          portal.update(state);
          if (previewVisible(v.openAmount, v.reveal, camera.position.z) && (!v.reduced || renderedSnapshot !== snapshot)) {
            if (target.width !== v.previewSize) target.setSize(v.previewSize, v.previewSize);
            const previous = gl.getRenderTarget();
            gl.setRenderTarget(target);
            gl.render(preview, previewCamera);
            gl.setRenderTarget(previous);
            renderedSnapshot = snapshot;
          }
          flash.visible = v.brightness > 0;
          flashMaterial.uniforms.uBrightness.value = v.brightness;
        } };
      register('s02', context);
      dispose = () => {
        parent.remove(gateMount, energy, flash);
        portal.dispose(); target.dispose(); glow.dispose(); spriteMaterial.dispose();
        ringGeometry.dispose(); ringMaterial.dispose(); flashGeometry.dispose(); flashMaterial.dispose();
      };
    }).catch(error => {
      if (!cancel.signal.aborted && error instanceof Error) onError();
    });
    return () => {
      cancel.abort(); register('s02', null); dispose?.();
      leases.forEach(lease => lease.release());
    };
  }, [residency, onError, gl, camera, world, profile, register, particleState]);

  return <group ref={root} name="s02" visible={false} dispose={null}>
    <directionalLight position={[-2, 4, 3]} intensity={2} />
    <group ref={particles}><ParticleField ref={field} profile={profile} active={active && profile.motion === 'full'} preset="converge" targetFn={origin} state={particleState} /></group>
  </group>;
}
