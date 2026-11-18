'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { usePathname } from 'next/navigation';
import { CircleGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getProjects } from '../../../content';
import { galleryProjects, worlds, type GalleryProject } from './projects';
import { Gallery } from './gallery';
import type { GalleryCtx } from './scene';
import { useExperienceStore } from '../../store';
import type { AssetResidency } from '../../assets/residency';
import type { Ctx, SceneId } from '../../contracts';
import { s05MultiverseData } from '../manifests';
import { useSceneKit, type SceneKitResources } from '../useSceneKit';

const PROJECT_BUBBLE_KEYS = ['realestate', 'investment', 'ecommerce', 'ecommerce', 'transport', 'logistics'] as const;
const BUBBLE_SCENE_RADIUS_RATIO = 0.93;

export default function Scene({ register, residency, onError }: { register: (id: SceneId, ctx: Ctx | null) => void; residency: AssetResidency | null; onError: () => void }) {
  const root = useRef<Group>(null);
  const gallery = useRef<Gallery | null>(null);
  const pendingWorld = useRef<{ index: number; scene: Group; project: GalleryProject } | null>(null);
  const gl = useThree(state => state.gl);
  const path = usePathname();
  const project = useExperienceStore(state => state.project);

  const onMount = useCallback((kit: Group, _extras: unknown[], { parent, ownedMaterials, ownedGeometries, addObject }: SceneKitResources) => {
    const shellProxy = new Group();
    shellProxy.name = 'S05_GalleryShellProxy';
    for (let i = 0; i < PROJECT_BUBBLE_KEYS.length; i++) {
      const key = PROJECT_BUBBLE_KEYS[i];
      const bubbleMeta = s05MultiverseData.bubbles[key];
      const bubbleNode = kit.getObjectByName(`S05_bubble_${key}`);
      const gate = new Group();
      gate.name = `Gate_${i + 1}`;
      if (bubbleNode) {
        gate.position.copy(bubbleNode.position);
        gate.quaternion.copy(bubbleNode.quaternion);
      } else {
        gate.position.set(bubbleMeta.centre_gltf[0], bubbleMeta.centre_gltf[1], bubbleMeta.centre_gltf[2]);
      }
      gate.translateZ(0.05);
      gate.scale.setScalar(bubbleMeta.radius * BUBBLE_SCENE_RADIUS_RATIO);
      shellProxy.add(gate);
    }

    const portalProxy = new Group();
    const surfaceGeometry = new CircleGeometry(1, 48);
    const uv = surfaceGeometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      // Match glTF image-space V so Gallery's render-target Y-flip displays upright.
      uv.setY(i, 1 - uv.getY(i));
    }
    uv.needsUpdate = true;
    const surfaceMaterial = new MeshBasicMaterial();
    const surface = new Mesh(surfaceGeometry, surfaceMaterial);
    surface.name = 'PortalSurface';
    const outer = new Group();
    outer.name = 'OuterRing';
    const inner = new Group();
    inner.name = 'InnerRing';
    portalProxy.add(surface, outer, inner);
    ownedGeometries.push(surfaceGeometry);
    ownedMaterials.push(surfaceMaterial);

    const view = new Gallery(gl, shellProxy, portalProxy, matchMedia('(pointer: coarse), (max-width: 600px)').matches);
    gallery.current = view;
    addObject(view.shell);

    const pending = pendingWorld.current;
    if (pending && pending.index === useExperienceStore.getState().project) {
      view.setWorld(pending.index, pending.scene, pending.project);
    }

    const ctx: GalleryCtx = {
      root: parent,
      ambient: 0,
      reducedMotion: false,
      updateGallery: visual => {
        view.update(visual, ctx.reducedMotion);
        const activeIdx = typeof visual.activeTarget === 'number' ? visual.activeTarget : -1;
        for (let i = 0; i < PROJECT_BUBBLE_KEYS.length; i++) {
          const gateSurface = view.shell.getObjectByName(`Gate_${i + 1}`)?.getObjectByName('PortalSurface');
          if (gateSurface) gateSurface.visible = i === activeIdx;
        }
      },
      beforeRender: camera => view.render(camera, ctx.reducedMotion, ctx.ambient, ctx.ambientWeight),
    };

    return {
      ctx,
      cleanup: () => {
        view.dispose();
        if (gallery.current === view) gallery.current = null;
      },
    };
  }, [gl]);

  useSceneKit({ sceneId: 's05', root, residency, register, onError, deps: [gl], onMount });

  useEffect(() => {
    if (!residency) return;
    let cancelled = false;
    const cancel = new AbortController();
    const lease = residency.acquire(`world.${worlds[project].slug}`, cancel.signal);
    void Promise.all([lease.ready, getProjects(path.startsWith('/ar') ? 'ar' : 'en')]).then(([asset, projects]) => {
      if (cancelled || cancel.signal.aborted) return;
      const worldScene = (asset.value as GLTF).scene;
      const projectData = galleryProjects(projects)[project];
      pendingWorld.current = { index: project, scene: worldScene, project: projectData };
      gallery.current?.setWorld(project, worldScene, projectData);
    }).catch(error => {
      if (!cancelled && !cancel.signal.aborted && error instanceof Error && error.name !== 'AbortError') onError();
    });
    function orbit(event: Event) {
      if (useExperienceStore.getState().profile.motion === 'reduced') return;
      const { yaw, pitch } = (event as CustomEvent<{ yaw: number; pitch: number }>).detail;
      if (Number.isFinite(yaw) && Number.isFinite(pitch)) gallery.current?.orbit(yaw, pitch);
    }
    window.addEventListener('nami:gallery-orbit', orbit);
    return () => {
      cancelled = true;
      cancel.abort();
      window.removeEventListener('nami:gallery-orbit', orbit);
      gallery.current?.clearWorld();
      lease.release();
      residency.evictUnused();
    };
  }, [residency, project, path, onError]);

  return <group ref={root} name="s05" visible={false} dispose={null} />;
}
