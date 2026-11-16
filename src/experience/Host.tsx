'use client';

/* eslint-disable react-hooks/immutability -- R3F owns this imperative runtime; it is never React state. */
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Canvas, useFrame, useThree, type RootState } from '@react-three/fiber';
import { usePathname } from 'next/navigation';
import type { PerspectiveCamera } from 'three';
import type { Ctx, Profile, SceneId } from './contracts';
import { createController, SCENE_IDS } from './controller';
import { createRuntime, type ExperienceRuntime } from './runtime';
import { CameraRig } from './camera/CameraRig';
import { useExperienceStore } from './store';
import { scenes } from './scenes';
import S01 from './scenes/s01';
import S02 from './scenes/s02';
import S03 from './scenes/s03';
import S04 from './scenes/s04';
import S05 from './scenes/s05';
import S06 from './scenes/s06';
import S07 from './scenes/s07';
import { createAssetLoader } from './assets/loaders';
import { acquireDestination, AssetResidency } from './assets/residency';
import { Robot } from './robot/Robot';
import { createHeadReaction, pointerNearHead } from './robot/procedural';
import styles from './experience.module.css';

type Services = ReturnType<typeof createAssetLoader> & { residency: AssetResidency; gl: RootState['gl'] };

function fallback() {
  const state = useExperienceStore.getState();
  useExperienceStore.setState({ profile: { ...state.profile, renderer: 'fallback' }, ui: { ready: false, contextLost: false } });
}

class CanvasBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { fallback(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function IntroFrame({ runtime, profile }: { runtime: ExperienceRuntime; profile: Profile }) {
  useFrame(state => {
    if (runtime.contextLost || !runtime.robotReady || !runtime.assetsReady || runtime.scene !== 's01' || runtime.intro.cancelled) return;
    const introSeconds = runtime.intro.sample(state.clock.elapsedTime, profile.motion === 'reduced');
    runtime.snapshot = scenes.s01.sample({ local: runtime.local, viewport: runtime.viewport, profile, interaction: runtime.interaction.state, seed: 1, ambient: 0, introSeconds });
  }, -2);
  return null;
}

function Frame({ runtime, rig, contexts, onFramed, energyLine }: {
  runtime: ExperienceRuntime;
  rig: CameraRig;
  contexts: Map<SceneId, Ctx>;
  onFramed: () => void;
  energyLine: RefObject<SVGPathElement | null>;
}) {
  const camera = useThree(state => state.camera) as PerspectiveCamera;
  useFrame((state, delta) => {
    if (runtime.contextLost) return;
    runtime.time = state.clock.elapsedTime;
    runtime.interaction.tick(runtime.time);
    rig.apply(camera, delta);
    runtime.cameraZ = camera.position.z;
    const hero = document.getElementById('s01');
    const visual = runtime.snapshot?.visual;
    if (runtime.scene === 's01' && hero && visual) {
      hero.style.setProperty('--headline-exit', String(visual.headlineExit));
      hero.style.setProperty('--subtitle-emphasis', String(visual.subtitleEmphasis));
      hero.style.setProperty('--scroll-hint', String(visual.scrollHint));
    }
    const line = energyLine.current;
    const reveal = runtime.scene === 's01' ? Number(visual?.line ?? 0) : 0;
    if (line) {
      line.style.opacity = reveal > 0 ? '1' : '0';
      if (reveal > 0) {
        const headline = document.querySelector('[data-s01-headline]')?.getBoundingClientRect();
        if (headline) {
          const { x, y } = runtime.handScreen;
          const endX = headline.left + headline.width / 2;
          const endY = headline.bottom + 8;
          line.setAttribute('d', `M${x},${y} Q${x},${endY} ${endX},${endY}`);
          line.style.strokeDashoffset = String(1 - reveal);
          line.style.clipPath = `inset(0 ${100 * (1 - reveal)}% 0 0)`;
        }
      }
    }
    // Apply only the resident scene before the host-owned render.
    for (let index = 0; index < SCENE_IDS.length; index++) {
      const id = SCENE_IDS[index];
      const ctx = contexts.get(id);
      if (!ctx) continue;
      ctx.root.visible = id === runtime.scene && runtime.assetsReady;
      if (ctx.root.visible && runtime.snapshot) {
        ctx.ambient = ctx.reducedMotion ? 0 : runtime.time;
        scenes[id].apply(runtime.snapshot, ctx);
      }
    }
    state.gl.render(state.scene, camera);
    if (runtime.assetsReady && runtime.robotReady && contexts.has(runtime.scene) && !runtime.framed) {
      runtime.framed = true;
      requestAnimationFrame(onFramed);
    }
  }, 1);
  return null;
}

export default function Host({ profile, mobile, dpr }: { profile: Profile; mobile: boolean; dpr: number }) {
  const runtime = useMemo(() => createRuntime(), []);
  const rig = useMemo(() => new CameraRig(), []);
  const contexts = useMemo(() => new Map<SceneId, Ctx>(), []);
  const energyLine = useRef<SVGPathElement>(null);
  const canReact = useMemo(() => createHeadReaction(), []);
  const [services, setServices] = useState<Services | null>(null);
  const renderer = useExperienceStore(state => state.profile.renderer);
  const pathname = usePathname();
  const register = useCallback((id: SceneId, ctx: Ctx | null) => {
    if (ctx) { ctx.reducedMotion = useExperienceStore.getState().profile.motion === 'reduced'; contexts.set(id, ctx); }
    else contexts.delete(id);
  }, [contexts]);
  const onFramed = useCallback(() => {
    if (runtime.framed && !runtime.contextLost && runtime.assetsReady) useExperienceStore.setState({ ui: { ready: true, contextLost: false } });
  }, [runtime]);
  const onCreated = useCallback((state: RootState) => {
    const loader = createAssetLoader(state.gl);
    setServices({ ...loader, gl: state.gl, residency: new AssetResidency(loader.load, profile.quality) });
  }, [profile.quality]);

  useEffect(() => {
    runtime.viewport.dpr = dpr;
    for (const ctx of contexts.values()) ctx.reducedMotion = profile.motion === 'reduced';
    let cancelled = false;
    let activeScene: SceneId | null = null;
    let cancellation: AbortController | undefined;
    let assets: ReturnType<typeof acquireDestination> | undefined;
    function release(evict = false) {
      cancellation?.abort();
      assets?.release();
      if (evict) services?.residency.evictUnused();
    }
    function acquire() {
      if (!services || runtime.contextLost || renderer === 'fallback') return;
      const previousAssets = assets;
      const previousCancellation = cancellation;
      runtime.assetsReady = scenes[runtime.scene].assets.every(key => services.residency.isResident(key));
      if (!runtime.assetsReady) {
        runtime.framed = false;
        useExperienceStore.setState({ ui: { ready: false, contextLost: false } });
      }
      cancellation = new AbortController();
      const signal = cancellation.signal;
      assets = acquireDestination(services.residency, runtime.scene, signal);
      previousCancellation?.abort();
      previousAssets?.release();
      void assets.ready.then(() => {
        if (!cancelled && !signal.aborted && !runtime.contextLost) runtime.assetsReady = true;
      }).catch(error => { if (!signal.aborted && !cancelled && error instanceof Error) fallback(); });
    }
    function sample(snap: boolean) {
      if (runtime.local > 0 || runtime.scene !== 's01' || profile.motion === 'reduced') runtime.intro.cancel();
      const definition = scenes[runtime.scene];
      const input = { local: runtime.local, viewport: runtime.viewport, profile, interaction: runtime.interaction.state, seed: 1, ambient: 0 };
      runtime.snapshot = definition.sample(input);
      const index = SCENE_IDS.indexOf(runtime.scene);
      const previous = index > 0 ? scenes[SCENE_IDS[index - 1]].sample({ ...input, local: 1 }).camera : runtime.snapshot.camera;
      rig.setPoses(previous, runtime.snapshot.camera, { blend: runtime.local / 0.08, snap: snap || runtime.scene === 's01' || profile.motion === 'reduced' });
      if (useExperienceStore.getState().scene !== runtime.scene) useExperienceStore.setState({ scene: runtime.scene, robotState: runtime.snapshot.robot });
      if (activeScene !== runtime.scene) { activeScene = runtime.scene; acquire(); }
    }
    const controller = createController(runtime, sample, profile.motion === 'reduced', mobile);
    controller.attach();
    function lost(event: Event) {
      event.preventDefault();
      runtime.contextLost = true;
      runtime.assetsReady = false;
      runtime.framed = false;
      release(true);
      useExperienceStore.setState({ ui: { ready: false, contextLost: true } });
    }
    function restored() {
      runtime.contextLost = false;
      sample(true);
      acquire();
    }
    function pointer(event: PointerEvent) {
      if (runtime.interaction.state.source && runtime.interaction.state.source !== 'pointer') return;
      runtime.pointer.x = event.clientX / Math.max(1, runtime.viewport.w) * 2 - 1;
      runtime.pointer.y = 1 - event.clientY / Math.max(1, runtime.viewport.h) * 2;
      runtime.pointer.active = true;
    }
    function leave(event: PointerEvent) { if (!event.relatedTarget) runtime.pointer.active = false; }
    function click(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('[data-s01-skip]')) {
        runtime.intro.cancel();
        runtime.interaction.narrativeChanged();
        runtime.seekVersion++;
        sample(true);
        return;
      }
      if (target.closest('a, button, input, select, textarea, [role="button"]') || event.button !== 0) return;
      if (runtime.scene === 's01' && profile.motion === 'full' && !runtime.interaction.state.source
        && pointerNearHead(event.clientX, event.clientY, runtime.headScreen) && canReact(runtime.time)) {
        runtime.interaction.react('React', runtime.time, 0.5);
      }
    }
    services?.gl.domElement.addEventListener('webglcontextlost', lost);
    services?.gl.domElement.addEventListener('webglcontextrestored', restored);
    window.addEventListener('pointermove', pointer, { passive: true });
    window.addEventListener('pointerout', leave, { passive: true });
    document.addEventListener('click', click);
    if (new URLSearchParams(location.search).get('experienceDebug') === '1') {
      window.__namiDebug = () => ({
        scene: runtime.scene, local: runtime.local, cameraZ: runtime.cameraZ,
        introCancelled: runtime.intro.cancelled, robotReady: runtime.robotReady, robotMeshes: runtime.robotMeshes,
        head: { ...runtime.headScreen }, robot: runtime.snapshot ? { ...runtime.snapshot.robot } : undefined,
        reaction: runtime.interaction.state.reaction?.name,
      });
    }
    return () => {
      cancelled = true;
      controller.detach();
      release();
      services?.gl.domElement.removeEventListener('webglcontextlost', lost);
      services?.gl.domElement.removeEventListener('webglcontextrestored', restored);
      window.removeEventListener('pointermove', pointer);
      window.removeEventListener('pointerout', leave);
      document.removeEventListener('click', click);
      delete window.__namiDebug;
    };
  }, [runtime, rig, contexts, services, profile, mobile, dpr, pathname, renderer, canReact]);

  useEffect(() => () => { services?.residency.evictUnused(); services?.dispose(); }, [services]);
  useEffect(() => { if (renderer === 'fallback') services?.residency.evictUnused(); }, [renderer, services]);

  if (renderer === 'fallback') return null;
  return <><svg className={styles.energyLine} aria-hidden="true"><path ref={energyLine} pathLength={1} /></svg><CanvasBoundary><Canvas className={styles.canvas} dpr={dpr} gl={{ antialias: profile.quality === 'high', alpha: true }} onCreated={onCreated} fallback={null}>
    <ambientLight intensity={1.6} />
    <directionalLight position={[3, 4, 5]} intensity={2} />
    <S01 register={register} /><S02 register={register} /><S03 register={register} /><S04 register={register} /><S05 register={register} /><S06 register={register} /><S07 register={register} />
    <IntroFrame runtime={runtime} profile={profile} />
    {services && <Robot runtime={runtime} profile={profile} residency={services.residency} onError={fallback} />}
    <Frame runtime={runtime} rig={rig} contexts={contexts} onFramed={onFramed} energyLine={energyLine} />
  </Canvas></CanvasBoundary></>;
}
