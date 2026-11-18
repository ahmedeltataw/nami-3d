'use client';

import { useEffect, type RefObject } from 'react';
import type { BufferGeometry, Group, Material, Object3D, Texture } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { AssetKey } from '../assets/manifest';
import { applyMatteCardMaterial } from '../assets/matte';
import type { AssetResidency } from '../assets/residency';
import { applyV2RuntimeMaterials } from '../assets/v2Materials';
import type { Ctx, SceneId } from '../contracts';
import { SCENE_HEROES } from './manifests';

export interface SceneKitResources {
  readonly parent: Group;
  readonly ownedMaterials: Material[];
  readonly ownedGeometries: BufferGeometry[];
  readonly ownedTextures: Texture[];
  addObject: (object: Object3D) => void;
}

export interface UseSceneKitOptions {
  sceneId: SceneId;
  root: RefObject<Group | null>;
  residency?: AssetResidency | null;
  register: (id: SceneId, ctx: Ctx | null) => void;
  onError?: () => void;
  enabled?: boolean;
  registerWithoutResidency?: boolean;
  extraKeys?: readonly AssetKey[];
  deps?: readonly unknown[];
  onMount: (kit: Group, extras: GLTF[], resources: SceneKitResources) => { ctx: Ctx; cleanup?: () => void };
}

export function useSceneKit({
  sceneId,
  root,
  residency,
  register,
  onError,
  enabled = true,
  registerWithoutResidency = false,
  extraKeys = [],
  deps = [],
  onMount,
}: UseSceneKitOptions) {
  useEffect(() => {
    const parent = root.current;
    if (!parent || !enabled) return;
    if (!residency) {
      if (!registerWithoutResidency) return;
      register(sceneId, { root: parent, ambient: 0, reducedMotion: false });
      return () => {
        register(sceneId, null);
      };
    }

    const cancel = new AbortController();
    const kitKey = `${sceneId}.kit` as AssetKey;
    const leases = [kitKey, ...extraKeys].map(key => residency.acquire(key, cancel.signal));
    const ownedMaterials: Material[] = [];
    const ownedGeometries: BufferGeometry[] = [];
    const ownedTextures: Texture[] = [];
    const mountedObjects: Object3D[] = [];
    let cancelled = false;
    let mountedCleanup: (() => void) | undefined;

    const addObject = (object: Object3D) => {
      parent.add(object);
      mountedObjects.push(object);
    };

    void Promise.all(leases.map(lease => lease.ready)).then(assets => {
      if (cancelled || cancel.signal.aborted) return;
      const kit = (assets[0].value as GLTF).scene.clone(true);
      const matteCard = SCENE_HEROES[sceneId].matteCard;
      if (matteCard) applyMatteCardMaterial(kit, matteCard, ownedMaterials);
      applyV2RuntimeMaterials(kit, sceneId, ownedMaterials, ownedGeometries);

      const extras = assets.slice(1).map(asset => asset.value as GLTF);
      const result = onMount(kit, extras, {
        parent,
        ownedMaterials,
        ownedGeometries,
        ownedTextures,
        addObject,
      });
      mountedCleanup = result.cleanup;
      addObject(kit);
      register(sceneId, result.ctx);
    }).catch(error => {
      if (!cancelled && !cancel.signal.aborted && error instanceof Error && error.name !== 'AbortError') {
        onError?.();
      }
    });

    return () => {
      cancelled = true;
      cancel.abort();
      register(sceneId, null);
      mountedCleanup?.();
      for (const obj of mountedObjects) parent.remove(obj);
      ownedMaterials.forEach(material => material.dispose());
      ownedGeometries.forEach(geometry => geometry.dispose());
      ownedTextures.forEach(texture => texture.dispose());
      leases.forEach(lease => lease.release());
      residency.evictUnused();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId, root, residency, register, onError, enabled, registerWithoutResidency, ...deps]);
}
