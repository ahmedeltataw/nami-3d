'use client';

import { useEffect, useRef } from 'react';
import { CanvasTexture, Color, Group, MeshStandardMaterial, SRGBColorSpace, Vector3, type Mesh, type Object3D } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Ctx, SceneId } from '../../contracts';
import type { AssetResidency } from '../../assets/residency';
import { assemblyOrder, type PhonePart } from './scene';

function paint(ctx: CanvasRenderingContext2D, stage: number) {
  const w = 256, h = 512;
  ctx.fillStyle = stage >= 5 ? '#f8faf9' : '#edf0ee'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = stage >= 5 ? '#007a55' : '#aebbb5'; ctx.fillRect(0, 0, w, 60);
  if (stage >= 1) { ctx.fillStyle = '#ffffff'; ctx.fillRect(18, 21, 65, 12); ctx.fillRect(180, 22, 52, 7); }
  if (stage >= 2) { ctx.fillStyle = '#25332d'; ctx.fillRect(18, 85, 145, 13); ctx.fillStyle = '#9aaba3'; ctx.fillRect(18, 111, 210, 6); ctx.fillRect(18, 125, 170, 6); }
  if (stage >= 3) { ctx.fillStyle = '#ffffff'; for (let i = 0; i < 3; i++) ctx.fillRect(18, 160 + i * 92, 220, 76); }
  if (stage >= 4) { ctx.fillStyle = stage >= 5 ? '#b5e8ce' : '#c9d2ce'; for (let i = 0; i < 3; i++) ctx.fillRect(28, 170 + i * 92, 58, 56); }
  if (stage >= 5) { ctx.fillStyle = '#007a55'; for (let i = 0; i < 3; i++) ctx.fillRect(98, 176 + i * 92, 100, 7); }
  if (stage >= 6) { ctx.fillStyle = '#007a55'; ctx.fillRect(18, 456, 220, 34); }
}

export default function Scene({ register, residency, onError }: { register: (id: SceneId, ctx: Ctx | null) => void; residency: AssetResidency | null; onError: () => void }) {
  const root = useRef<Group>(null);
  useEffect(() => {
    if (!root.current || !residency) return;
    const parent = root.current;
    const lease = residency.acquire('phone.kit');
    let cancelled = false;
    let texture: CanvasTexture | undefined;
    let material: MeshStandardMaterial | undefined;
    void lease.ready.then(asset => {
      if (cancelled) return;
      const phone = (asset.value as GLTF).scene.clone(true);
      phone.position.set(.82, 0, 0); phone.scale.setScalar(1.55);
      const parts: PhonePart[] = assemblyOrder.map((name, order) => {
        const node = phone.getObjectByName(name);
        if (!node) throw new Error(`Missing phone part ${name}`);
        const direction = node.userData.exploded_direction as number[] | undefined;
        const distance = Number(node.userData.exploded_distance ?? 0);
        if (!direction || direction.length !== 3) throw new Error(`Missing explode metadata for ${name}`);
        return { node, assembled: node.position.clone(), offset: new Vector3(...direction as [number, number, number]).multiplyScalar(distance), order };
      });
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 512;
      const drawing = canvas.getContext('2d');
      const nextCanvas = document.createElement('canvas'); nextCanvas.width = 256; nextCanvas.height = 512;
      const next = nextCanvas.getContext('2d');
      if (!drawing || !next) throw new Error('Canvas texture unavailable');
      texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; texture.flipY = false;
      material = new MeshStandardMaterial({ color: new Color('#ffffff'), map: texture, emissive: new Color('#ffffff'), emissiveMap: texture, emissiveIntensity: .65 });
      const display = phone.getObjectByName('Display')!;
      display.traverse((node: Object3D) => { const mesh = node as Mesh; if (mesh.isMesh) mesh.material = material!; });
      let previous = '';
      const drawDisplay = (stage: number, blend: number) => {
        const key = `${stage}:${Math.round(blend * 100)}`; if (key === previous) return; previous = key;
        paint(drawing, stage);
        if (stage < 6 && blend > 0) { paint(next, stage + 1); drawing.save(); drawing.globalAlpha = blend; drawing.drawImage(nextCanvas, 0, 0); drawing.restore(); }
        texture!.needsUpdate = true;
      };
      const target = new Group(); target.name = 'PhoneTarget'; phone.add(target);
      parent.add(phone); drawDisplay(0, 0);
      register('s04', { root: parent, ambient: 0, reducedMotion: false, model: phone, parts, drawDisplay } as Ctx);
    }).catch(error => { if (!cancelled && error instanceof Error && error.name !== 'AbortError') onError(); });
    return () => { cancelled = true; register('s04', null); parent.clear(); material?.dispose(); texture?.dispose(); lease.release(); residency.evictUnused(); };
  }, [register, residency, onError]);
  return <group ref={root} name="s04" visible={false} dispose={null} />;
}
