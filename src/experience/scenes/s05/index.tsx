'use client';

import { useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import { usePathname } from 'next/navigation';
import type { Group } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { getProjects } from '../../../content';
import { galleryProjects, worlds } from './projects';
import { Gallery } from './gallery';
import type { GalleryCtx } from './scene';
import { useExperienceStore } from '../../store';
import type { AssetResidency } from '../../assets/residency';
import type { Ctx, SceneId } from '../../contracts';

export default function Scene({ register, residency, onError }: { register: (id: SceneId, ctx: Ctx | null) => void; residency: AssetResidency | null; onError: () => void }) {
  const root = useRef<Group>(null);
  const gallery = useRef<Gallery | null>(null);
  const gl = useThree(state => state.gl);
  const path = usePathname();
  const project = useExperienceStore(state => state.project);
  useEffect(() => {
    if (!residency || !root.current) return;
    const parent = root.current;
    let cancelled = false;
    const leases = [residency.acquire('gallery.shell'), residency.acquire('gallery.portal')];
    void Promise.all(leases.map(lease => lease.ready)).then(assets => {
      if (cancelled) return;
      const view = new Gallery(gl, (assets[0].value as GLTF).scene, (assets[1].value as GLTF).scene, matchMedia('(pointer: coarse), (max-width: 600px)').matches);
      gallery.current = view; parent.add(view.shell);
      const ctx: GalleryCtx = { root: parent, ambient: 0, reducedMotion: false,
        updateGallery: visual => view.update(visual, ctx.reducedMotion), beforeRender: camera => view.render(camera, ctx.reducedMotion, ctx.ambient, ctx.ambientWeight) };
      register('s05', ctx);
    }).catch(error => { if (!cancelled && error.name !== 'AbortError') onError(); });
    return () => { cancelled = true; register('s05', null); gallery.current?.dispose(); gallery.current = null; parent.clear(); leases.forEach(lease => lease.release()); };
  }, [register, residency, gl, onError]);
  useEffect(() => {
    if (!residency) return;
    let cancelled = false;
    const shell = residency.acquire('gallery.shell');
    const portal = residency.acquire('gallery.portal');
    const lease = residency.acquire(`world.${worlds[project].slug}`);
    void Promise.all([shell.ready, portal.ready, lease.ready, getProjects(path.startsWith('/ar') ? 'ar' : 'en')]).then(([, , asset, projects]) => {
      if (!cancelled) gallery.current?.setWorld(project, (asset.value as GLTF).scene, galleryProjects(projects)[project]);
    }).catch(error => { if (!cancelled && error.name !== 'AbortError') onError(); });
    function orbit(event: Event) {
      if (useExperienceStore.getState().profile.motion === 'reduced') return;
      const { yaw, pitch } = (event as CustomEvent<{ yaw: number; pitch: number }>).detail;
      if (Number.isFinite(yaw) && Number.isFinite(pitch)) gallery.current?.orbit(yaw, pitch);
    }
    window.addEventListener('nami:gallery-orbit', orbit);
    return () => { cancelled = true; window.removeEventListener('nami:gallery-orbit', orbit); gallery.current?.clearWorld(); lease.release(); shell.release(); portal.release(); residency.evictUnused(); };
  }, [residency, project, path, onError]);
  return <group ref={root} name="s05" visible={false} dispose={null} />;
}
