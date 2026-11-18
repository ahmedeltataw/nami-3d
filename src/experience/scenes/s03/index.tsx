'use client';

import { useCallback, useMemo, useRef } from 'react';
import { Group, PointLight, type Color, type Material, type Mesh } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { AssetKey } from '../../assets/manifest';
import type { AssetResidency } from '../../assets/residency';
import type { Ctx, SceneId } from '../../contracts';
import { s03BindingsData } from '../manifests';
import { useSceneKit, type SceneKitResources } from '../useSceneKit';
import { bindStation, stations } from './station';
import { scene, type DimMaterial } from './scene';

const SOURCE_GLB_KEY: Record<string, number> = {
  'station_1_web.glb': 0,
  'station_2_mobile.glb': 1,
  'station_3_marketing.glb': 2,
  'station_4_consulting.glb': 3,
  'station_5_cloud.glb': 4,
  'station_6_design.glb': 5,
};

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
  const extraKeys = useMemo(
    () => scene.assets.filter((key): key is AssetKey => key !== 'poster:s03' && key !== 's03.kit'),
    [],
  );

  const onMount = useCallback((kit: Group, extras: GLTF[], { parent, ownedMaterials }: SceneKitResources) => {
    const stationScenes = extras.map(asset => asset.scene);
    const stationGroups = new Map<string, Group>();
    const stationDims = new Map<string, DimMaterial[]>();

    // Mount unit-scale pedestal anchors at worldOriginGlb (never parent under scaled S03_pedestal_*).
    for (const [pedestalName, pedestal] of Object.entries(s03BindingsData.pedestals)) {
      const anchor = new Group();
      anchor.name = `DemoProps_${pedestal.station}`;
      anchor.position.set(pedestal.worldOriginGlb[0], pedestal.worldOriginGlb[1], pedestal.worldOriginGlb[2]);
      kit.add(anchor);
      stationGroups.set(pedestalName, anchor);
      stationDims.set(pedestal.station, []);
    }

    for (const binding of s03BindingsData.bindings) {
      const srcIdx = SOURCE_GLB_KEY[binding.sourceGlb];
      const sourceScene = srcIdx !== undefined ? stationScenes[srcIdx] : undefined;
      const sourceNode = sourceScene?.getObjectByName(binding.sourceNode);
      const anchor = stationGroups.get(binding.pedestal);
      if (!sourceNode || !anchor) throw new Error(`Missing S03 demo binding ${binding.sourceGlb}:${binding.sourceNode}`);

      const prop = sourceNode.clone(true);
      const clones = new Map<Material, Material>();
      const dim = stationDims.get(binding.station)!;
      const cloneMaterial = (material: Material) => {
        let copy = clones.get(material);
        if (!copy) {
          copy = material.clone();
          clones.set(material, copy);
          ownedMaterials.push(copy);
          if ('color' in copy) {
            const colored = copy as Material & { color: Color };
            dim.push({ material: colored, color: colored.color.clone() });
          }
        }
        return copy;
      };
      prop.traverse(node => {
        const mesh = node as Mesh;
        if (mesh.material) mesh.material = Array.isArray(mesh.material) ? mesh.material.map(cloneMaterial) : cloneMaterial(mesh.material);
      });
      const pos = binding.localTransform.position;
      const rot = binding.localTransform.rotationEuler;
      const scl = binding.localTransform.scale;
      prop.position.set(pos[0], pos[1], pos[2]);
      prop.rotation.set(rot[0], rot[1], rot[2], 'XYZ');
      prop.scale.set(scl[0], scl[1], scl[2]);
      anchor.add(prop);
    }

    const lights: PointLight[] = [];
    const materials: DimMaterial[][] = [];
    const stationCodeById = ['code', 'phone', 'chart', 'headphones', 'cloud', 'layers'] as const;
    stations.forEach((station, index) => {
      const code = stationCodeById[index];
      const pedestal = Object.values(s03BindingsData.pedestals).find(p => p.station === code);
      materials.push(stationDims.get(code) ?? []);
      const light = new PointLight('#8be7bb', 0, 5);
      light.name = `StationLight_${station.id}`;
      if (pedestal) light.position.set(pedestal.worldOriginGlb[0], pedestal.worldOriginGlb[1] + 2, pedestal.worldOriginGlb[2] + 1);
      else light.position.set(0, 2, 1);
      kit.add(light);
      lights.push(light);
    });

    return {
      ctx: { root: parent, ambient: 0, reducedMotion: false, nodes: bindStation(kit), lights, materials } as Ctx,
    };
  }, []);

  useSceneKit({ sceneId: 's03', root, residency, register, onError, extraKeys, onMount });

  return <group ref={root} name="s03" visible={false} dispose={null} />;
}
