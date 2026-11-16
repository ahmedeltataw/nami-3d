'use client';

import { useEffect, useImperativeHandle, useMemo, type Ref } from 'react';
import { useFrame } from '@react-three/fiber';
import { ShaderMaterial, DoubleSide, type Material, type Mesh, type MeshStandardMaterial, type Object3D, type Texture } from 'three';
import { segmentDistance } from './motion';

export type PortalState = { assembleProgress: number; ringSpeed: number; openAmount: number; surfaceTexture: Texture | null; time?: number; reduced?: boolean };
export type PortalHandle = { update: (state: PortalState) => void };
type Segment = { node: Object3D; x: number; y: number; z: number; radialX: number; radialY: number; index: number };

export const portalVertexShader = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
export const portalFragmentShader = `
uniform sampler2D uPreview;
uniform float uTime;
uniform float uOpen;
varying vec2 vUv;
void main() {
  vec2 q = vUv - 0.5;
  float r = length(q) * 2.0;
  float angle = atan(q.y, q.x);
  float twist = (1.0 - r) * (0.65 + 0.15 * sin(uTime * 1.7)) * uOpen;
  vec2 warped = vec2(cos(angle + twist), sin(angle + twist)) * length(q) + 0.5;
  warped += 0.012 * uOpen * sin(vec2(q.y, q.x) * 35.0 + uTime * 2.0);
  vec3 preview = texture2D(uPreview, clamp(warped, 0.001, 0.999)).rgb;
  float swirl = 0.5 + 0.5 * sin(angle * 5.0 - r * 20.0 - uTime * 3.0);
  vec3 green = vec3(0.0, 0.624, 0.435);
  vec3 color = mix(green * (0.35 + swirl * 0.6), preview, uOpen * 0.85);
  color += green * pow(r, 8.0) * 1.2;
  gl_FragColor = vec4(color, uOpen);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function bindPortal(model: Object3D) {
  const root = model.clone(true);
  const segments: Segment[] = [];
  const materials = new Map<Material, Material>();
  const channels: MeshStandardMaterial[] = [];
  const surface = root.getObjectByName('PortalSurface') as Mesh | undefined;
  root.traverse(node => {
    const match = /^(OuterSeg|Connector)_(\d+)$/.exec(node.name);
    if (match) {
      const index = Number(match[2]) - 1;
      const angle = Number(node.userData.mid_angle_deg ?? (90 - index * 36)) * Math.PI / 180;
      segments.push({ node, x: node.position.x, y: node.position.y, z: node.position.z, radialX: Math.cos(angle), radialY: Math.sin(angle), index });
    }
    const mesh = node as Mesh;
    if (!mesh.material) return;
    const clone = (material: Material) => {
      let copy = materials.get(material);
      if (!copy) {
        copy = material.clone(); materials.set(material, copy);
        if (copy.name === 'LightChannel') channels.push(copy as MeshStandardMaterial);
      }
      return copy;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(clone) : clone(mesh.material);
  });
  const material = new ShaderMaterial({ vertexShader: portalVertexShader, fragmentShader: portalFragmentShader,
    uniforms: { uTime: { value: 0 }, uOpen: { value: 0 }, uPreview: { value: null } },
    transparent: true, depthWrite: false, side: DoubleSide });
  if (surface) surface.material = material;
  const outer = root.getObjectByName('OuterRing');
  const inner = root.getObjectByName('InnerRing');
  return {
    root, material, segments, outer, inner,
    update(state: PortalState) {
      root.visible = state.assembleProgress > 0;
      for (let i = 0; i < segments.length; i++) {
        const part = segments[i];
        const distance = segmentDistance(state.assembleProgress, part.index);
        part.node.position.set(part.x + distance * part.radialX, part.y + distance * part.radialY, part.z);
      }
      const time = state.reduced ? 0 : state.time ?? 0;
      if (outer) outer.rotation.z = -Math.max(0, state.ringSpeed) * time;
      if (inner) inner.rotation.z = Math.max(0, state.ringSpeed) * time * 1.35;
      for (let i = 0; i < channels.length; i++) channels[i].emissiveIntensity = 3 + (state.reduced ? 0 : 3 * (0.5 + 0.5 * Math.sin(time * 8)));
      material.uniforms.uOpen.value = state.openAmount;
      material.uniforms.uTime.value = time;
      material.uniforms.uPreview.value = state.surfaceTexture;
      if (surface) surface.visible = state.openAmount > 0;
    },
    dispose() { materials.forEach(copy => copy.dispose()); material.dispose(); },
  };
}

export function Portal({ model, ref, ...state }: PortalState & { model: Object3D; ref?: Ref<PortalHandle> }) {
  const portal = useMemo(() => bindPortal(model), [model]);
  useImperativeHandle(ref, () => portal, [portal]);
  useEffect(() => () => portal.dispose(), [portal]);
  useFrame(() => { if (portal.root.parent?.visible) portal.update(state); });
  return <primitive object={portal.root} dispose={null} />;
}
