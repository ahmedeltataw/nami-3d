'use client';

import { useCallback, useRef } from 'react';
import {
  CanvasTexture,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  Vector3,
  type Object3D,
} from 'three';
import type { Ctx, SceneId } from '../../contracts';
import type { AssetResidency } from '../../assets/residency';
import { s04PhoneData } from '../manifests';
import { useSceneKit, type SceneKitResources } from '../useSceneKit';
import { type assemblyOrder, type PhonePart } from './scene';

const ROLE_TO_LEGACY_PART: Record<string, (typeof assemblyOrder)[number]> = {
  back_plate: 'BackPlate',
  buttons: 'Buttons',
  board: 'Board',
  battery: 'Battery',
  speaker: 'Speaker',
  camera_module: 'CameraModule',
  glass: 'Glass',
  display: 'Display',
};

function paint(ctx: CanvasRenderingContext2D, stage: number, finalImage?: CanvasImageSource) {
  const w = 256;
  const h = 512;
  if (stage >= 6 && finalImage) {
    ctx.drawImage(finalImage, 0, 0, w, h);
    return;
  }
  ctx.fillStyle = stage >= 5 ? '#f8faf9' : '#edf0ee';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = stage >= 5 ? '#007a55' : '#aebbb5';
  ctx.fillRect(0, 0, w, 60);
  if (stage >= 1) { ctx.fillStyle = '#ffffff'; ctx.fillRect(18, 21, 65, 12); ctx.fillRect(180, 22, 52, 7); }
  if (stage >= 2) { ctx.fillStyle = '#25332d'; ctx.fillRect(18, 85, 145, 13); ctx.fillStyle = '#9aaba3'; ctx.fillRect(18, 111, 210, 6); ctx.fillRect(18, 125, 170, 6); }
  if (stage >= 3) { ctx.fillStyle = '#ffffff'; for (let i = 0; i < 3; i++) ctx.fillRect(18, 160 + i * 92, 220, 76); }
  if (stage >= 4) { ctx.fillStyle = stage >= 5 ? '#b5e8ce' : '#c9d2ce'; for (let i = 0; i < 3; i++) ctx.fillRect(28, 170 + i * 92, 58, 56); }
  if (stage >= 5) { ctx.fillStyle = '#007a55'; for (let i = 0; i < 3; i++) ctx.fillRect(98, 176 + i * 92, 100, 7); }
  if (stage >= 6) { ctx.fillStyle = '#007a55'; ctx.fillRect(18, 456, 220, 34); }
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

  const onMount = useCallback((kit: Group, _extras: unknown[], { parent, ownedMaterials, ownedTextures }: SceneKitResources) => {
    const phoneNode = kit.getObjectByName('S04_phone');
    if (!phoneNode || !phoneNode.parent) throw new Error('Missing S04_phone in s04_idea_v2.glb');

    // Split S04_phone's own frame mesh into a child `Frame` proxy so Explore layer
    // toggles hide only the bezel without hiding all exploded child parts.
    const phoneGroup = new Group();
    phoneGroup.name = 'S04_phone';
    phoneGroup.position.copy(phoneNode.position);
    phoneGroup.quaternion.copy(phoneNode.quaternion);
    phoneGroup.scale.copy(phoneNode.scale);
    phoneGroup.userData = { ...phoneNode.userData };
    if ((phoneNode as Mesh).isMesh) {
      const frameMesh = new Mesh((phoneNode as Mesh).geometry, (phoneNode as Mesh).material);
      frameMesh.name = 'S04_phone_frame';
      const frameProxy = new Group();
      frameProxy.name = 'Frame';
      frameProxy.add(frameMesh);
      phoneGroup.add(frameProxy);
    }
    for (const child of [...phoneNode.children]) phoneGroup.add(child);
    const phoneParent = phoneNode.parent;
    const phoneIndex = phoneParent.children.indexOf(phoneNode);
    phoneParent.remove(phoneNode);
    phoneParent.add(phoneGroup);
    if (phoneIndex >= 0 && phoneParent.children.length > 1) {
      phoneParent.children.pop();
      phoneParent.children.splice(phoneIndex, 0, phoneGroup);
    }

    const parts: PhonePart[] = s04PhoneData.explodedParts.map((spec, index) => {
      const node = phoneGroup.getObjectByName(spec.node);
      if (!node) throw new Error(`Missing phone part ${spec.node}`);
      const legacyName = ROLE_TO_LEGACY_PART[spec.role];
      const proxy = new Group();
      proxy.name = legacyName;
      proxy.position.copy(node.position);
      node.position.set(0, 0, 0);
      phoneGroup.remove(node);
      proxy.add(node);
      phoneGroup.add(proxy);

      const direction = (node.userData.exploded_direction as number[] | undefined) ?? spec.exploded_direction;
      const distance = Number(node.userData.exploded_distance ?? spec.exploded_distance);
      return {
        node: proxy,
        assembled: proxy.position.clone(),
        offset: new Vector3(...(direction as [number, number, number])).multiplyScalar(distance),
        order: index + 1,
      };
    });

    const screenNode = phoneGroup.getObjectByName('S04_phone_screen')!;
    let finalImage: CanvasImageSource | undefined;
    screenNode.traverse((node: Object3D) => {
      const mesh = node as Mesh;
      if (mesh.isMesh && mesh.material && !finalImage) {
        const srcMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        const std = srcMat as MeshStandardMaterial;
        const img = (std.emissiveMap?.image ?? std.map?.image) as CanvasImageSource | undefined;
        if (img) finalImage = img;
      }
    });

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const drawing = canvas.getContext('2d');
    const nextCanvas = document.createElement('canvas');
    nextCanvas.width = 256;
    nextCanvas.height = 512;
    const next = nextCanvas.getContext('2d');
    if (!drawing || !next) throw new Error('Canvas texture unavailable');

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.flipY = false;
    const material = new MeshStandardMaterial({
      color: new Color('#ffffff'),
      map: texture,
      emissive: new Color('#ffffff'),
      emissiveMap: texture,
      emissiveIntensity: 0.8,
    });
    ownedTextures.push(texture);
    ownedMaterials.push(material);
    screenNode.traverse((node: Object3D) => {
      const mesh = node as Mesh;
      if (mesh.isMesh) mesh.material = material;
    });

    let previous = '';
    const drawDisplay = (stage: number, blend: number) => {
      const key = `${stage}:${Math.round(blend * 100)}`;
      if (key === previous) return;
      previous = key;
      paint(drawing, stage, finalImage);
      if (stage < 6 && blend > 0) {
        paint(next, stage + 1, finalImage);
        drawing.save();
        drawing.globalAlpha = blend;
        drawing.drawImage(nextCanvas, 0, 0);
        drawing.restore();
      }
      texture.needsUpdate = true;
    };

    const target = new Group();
    target.name = 'PhoneTarget';
    phoneGroup.add(target);
    drawDisplay(0, 0);

    return {
      ctx: { root: parent, ambient: 0, reducedMotion: false, model: phoneGroup, parts, drawDisplay } as Ctx,
    };
  }, []);

  useSceneKit({ sceneId: 's04', root, residency, register, onError, onMount });

  return <group ref={root} name="s04" visible={false} dispose={null} />;
}
