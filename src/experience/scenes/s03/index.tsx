'use client';

import { useEffect, useRef } from 'react';
import { PointLight, type Color, type Group, type Material, type Mesh } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Ctx, SceneId } from '../../contracts';
import type { AssetResidency } from '../../assets/residency';
import { stations, bindStation } from './station';
import { scene, type DimMaterial } from './scene';

export default function Scene({ register, residency, onError }: { register: (id: SceneId, ctx: Ctx | null) => void; residency: AssetResidency | null; onError: () => void }) {
  const root = useRef<Group>(null);
  useEffect(() => {
    if (!residency || !root.current) return;
    const parent = root.current;
    const leases = scene.assets.filter(key => key !== 'poster:s03').map(key => residency.acquire(key));
    const ownedMaterials: Material[] = [];
    let cancelled = false;
    void Promise.all(leases.map(lease => lease.ready)).then(assets => {
      if (cancelled) return;
      const shell = (assets[0].value as GLTF).scene.clone(true);
      // The arms are shared geometry; transforms are local to the station mount.
      const arms = (assets[1].value as GLTF).scene.clone(true);
      const lights: PointLight[] = [];
      const materials: DimMaterial[][] = [];
      stations.forEach((station, index) => {
        const mount = shell.getObjectByName(`Station_${station.id}`);
        if (!mount) throw new Error(`Missing Station_${station.id}`);
        const model = (assets[index + 2].value as GLTF).scene.clone(true);
        const clones = new Map<Material, Material>();
        const dim: DimMaterial[] = [];
        const cloneMaterial = (material: Material) => {
          let copy = clones.get(material);
          if (!copy) {
            copy = material.clone(); clones.set(material, copy); ownedMaterials.push(copy);
            if ('color' in copy) {
              const colored = copy as Material & { color: Color };
              dim.push({ material: colored, color: colored.color.clone() });
            }
          }
          return copy;
        };
        model.traverse(node => {
          const mesh = node as Mesh;
          if (mesh.material) mesh.material = Array.isArray(mesh.material) ? mesh.material.map(cloneMaterial) : cloneMaterial(mesh.material);
        });
        materials.push(dim);
        mount.add(model);
        const light = new PointLight('#8be7bb', 0, 5);
        light.name = `StationLight_${station.id}`;
        light.position.set(0, 2, 1);
        mount.add(light);
        lights.push(light);
        if (station.id === 1) mount.add(arms);
      });
      parent.add(shell);
      register('s03', { root: parent, ambient: 0, reducedMotion: false, nodes: bindStation(parent), lights, materials } as Ctx);
    }).catch(error => { if (!cancelled && error instanceof Error && error.name !== 'AbortError') onError(); });
    return () => { cancelled = true; register('s03', null); parent.clear(); ownedMaterials.forEach(material => material.dispose()); leases.forEach(lease => lease.release()); residency.evictUnused(); };
  }, [register, residency, onError]);
  return <group ref={root} name="s03" visible={false} dispose={null} />;
}
