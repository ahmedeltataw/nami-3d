'use client';

/* eslint-disable react-hooks/immutability -- R3F owns this imperative runtime; it is never React state. */
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Canvas, useFrame, useThree, type RootState } from '@react-three/fiber';
import { usePathname } from 'next/navigation';
import { Matrix4, Quaternion, Vector3, type PerspectiveCamera } from 'three';
import type { Ctx, Profile, SceneId } from './contracts';
import { createController, SCENE_IDS } from './controller';
import { createRuntime, type ExperienceRuntime } from './runtime';
import { CameraRig } from './camera/CameraRig';
import { useExperienceStore } from './store';
import { scenes } from './scenes';
import { sceneRegistrations } from './scenes/registration';
import { drawEnergyLine } from './scenes/s01/headline';
import { createAssetLoader } from './assets/loaders';
import { AssetResidency, keysForScene, worldKeys } from './assets/residency';
import { mountedScenes, residentScenes, sampleBoundary, transitions } from './transitions';
import { TransitionResidency } from './transitions/residency';
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
  energyLine: RefObject<HTMLCanvasElement | null>;
}) {
  const camera = useThree(state => state.camera) as PerspectiveCamera;
  const gaze = useMemo(() => new Vector3(), []);
  const orbitPosition = useMemo(() => new Vector3(), []);
  const orbitTarget = useMemo(() => new Vector3(.82, 0, 0), []);
  useFrame((state, delta) => {
    if (runtime.contextLost) return;
    runtime.time = state.clock.elapsedTime;
    runtime.interaction.tick(runtime.time);
    if (runtime.exploration.active && runtime.scene === 's04' && runtime.snapshot) {
      const o = runtime.orbit;
      orbitPosition.set(orbitTarget.x + Math.sin(o.yaw) * Math.cos(o.pitch) * o.distance, Math.sin(o.pitch) * o.distance, Math.cos(o.yaw) * Math.cos(o.pitch) * o.distance);
      const q = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(orbitPosition, orbitTarget, new Vector3(0, 1, 0)));
      const pose = { ...runtime.snapshot.camera, position: orbitPosition.toArray() as [number, number, number], quaternion: q.toArray() as [number, number, number, number] };
      rig.setPoses(pose, pose, { blend: 1, snap: false });
      if (runtime.replayStart !== null) {
        const local = Math.min(.6, .1 + (state.clock.elapsedTime - runtime.replayStart) * .16);
        runtime.snapshot = scenes.s04.sample({ local, viewport: runtime.viewport, profile: runtime.profile, interaction: runtime.interaction.state, seed: 1, ambient: 0 });
        if (local >= .6) {
          runtime.replayStart = null;
          runtime.snapshot = scenes.s04.sample({ local: runtime.local, viewport: runtime.viewport, profile: runtime.profile, interaction: runtime.interaction.state, seed: 1, ambient: 0 });
        }
      }
    }
    rig.apply(camera, delta);
    runtime.cameraZ = camera.position.z;
    const hero = document.getElementById('s01');
    const visual = runtime.snapshot?.visual;
    if (runtime.scene === 's01' && hero && visual) {
      hero.style.setProperty('--headline-exit', String(visual.headlineExit));
      hero.style.setProperty('--subtitle-emphasis', String(visual.subtitleEmphasis));
      hero.style.setProperty('--scroll-hint', String(visual.scrollHint));
      hero.style.setProperty('--headline-reveal', `${visual.headlineReveal}%`);
    }
    const line = energyLine.current;
    const reveal = runtime.scene === 's01' ? Number(visual?.line ?? 0) : 0;
    if (line) {
      line.style.opacity = reveal > 0 && reveal < 1 ? '1' : '0';
      const headline = document.querySelector('[data-s01-headline]')?.getBoundingClientRect();
      if (headline) drawEnergyLine(line, headline, runtime.handScreen, reveal, document.documentElement.dir === 'rtl', runtime.viewport.dpr);
    }
    for (let index = 0; index < SCENE_IDS.length; index++) {
      const id = SCENE_IDS[index];
      const ctx = contexts.get(id);
      if (!ctx) continue;
      const transition = runtime.transition;
      const intents = runtime.transitionContext.intents;
      const visibility = transition && id === transitions[transition.id].from ? intents?.fromVisibility ?? 0
        : transition && id === transitions[transition.id].to ? intents?.toVisibility ?? 0 : Number(id === runtime.scene);
      ctx.root.visible = visibility > 0 && runtime.assetsReady;
      const snapshot = id === runtime.scene ? runtime.snapshot : runtime.sceneSnapshots[id];
      if (ctx.root.visible && snapshot) {
        ctx.ambient = ctx.reducedMotion ? 0 : runtime.time;
        scenes[id].apply(snapshot, ctx);
        const directive = runtime.transitionContext.intents?.robot.directive ?? runtime.snapshot?.robot;
        if (id !== runtime.scene) { ctx.beforeRender?.(camera); continue; }
        if (directive?.kind === 'point') {
          const target = ctx.root.getObjectByName(directive.target);
          if (target) { target.getWorldPosition(gaze); runtime.taskGaze = gaze; }
        } else runtime.taskGaze = null;
        if (Array.isArray(snapshot.visual.gazeTarget)) {
          gaze.fromArray(snapshot.visual.gazeTarget as number[]); runtime.taskGaze = gaze;
        }
        ctx.beforeRender?.(camera);
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
  runtime.profile = profile;
  const rig = useMemo(() => new CameraRig(), []);
  const contexts = useMemo(() => new Map<SceneId, Ctx>(), []);
  const energyLine = useRef<HTMLCanvasElement>(null);
  const canReact = useMemo(() => createHeadReaction(), []);
  const [services, setServices] = useState<Services | null>(null);
  const renderer = useExperienceStore(state => state.profile.renderer);
  const [resident, setResident] = useState<SceneId[]>(['s01']);
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
    let assetSignature = '';
    let mountSignature = '';
    const assets = services ? new TransitionResidency(services.residency) : null;
    function release(evict = false) {
      assets?.release();
      assetSignature = '';
      if (evict) services?.residency.evictUnused();
    }
    function acquire() {
      if (!services || runtime.contextLost || renderer === 'fallback') return;
      const reduced = profile.motion === 'reduced';
      const mounted = mountedScenes(runtime.scene, runtime.local, reduced);
      const projectFor = (id: SceneId) => Number(runtime.sceneSnapshots[id]?.visual.project ?? useExperienceStore.getState().project);
      // Active destination comes first on cold seeks; the other scene is acquired before any release.
      const ordered = [runtime.scene, ...mounted.filter(id => id !== runtime.scene)];
      const required = ordered.flatMap(id => keysForScene(id, projectFor(id)).filter(key => id === runtime.scene || !key.startsWith('poster:')));
      const warm = residentScenes(runtime.scene, runtime.local, reduced).filter(id => !mounted.includes(id))
        .flatMap(id => keysForScene(id, id === 's05' && runtime.scene === 's06' ? 5 : 0).filter(key => !key.startsWith('poster:')));
      if (mounted.includes('s05')) warm.push(...worldKeys(projectFor('s05'), true));
      const signature = `${required.join(',')}|${warm.join(',')}`;
      if (assetSignature === signature) return;
      assetSignature = signature;
      runtime.assetsReady = required.every(key => services.residency.isResident(key));
      if (!runtime.assetsReady) {
        runtime.framed = false;
        useExperienceStore.setState({ ui: { ready: false, contextLost: false } });
      }
      assets?.update(required, warm, () => {
        if (!cancelled && !runtime.contextLost) runtime.assetsReady = true;
      }, error => { if (!cancelled && error instanceof Error && error.name !== 'AbortError') fallback(); });
    }
    function sample(snap: boolean) {
      if (runtime.local > 0 || runtime.scene !== 's01' || profile.motion === 'reduced') runtime.intro.cancel();
      const definition = scenes[runtime.scene];
      const input = { local: runtime.local, viewport: runtime.viewport, profile, interaction: runtime.interaction.state, seed: 1, ambient: 0 };
      runtime.snapshot = definition.sample(input);
      const boundary = sampleBoundary(runtime.scene, input, runtime.snapshot);
      runtime.transition = boundary.transition;
      if (runtime.transition) transitions[runtime.transition.id].apply(runtime.transition, runtime.transitionContext);
      else runtime.transitionContext.intents = null;
      runtime.sceneSnapshots = boundary.snapshots;
      const mounted = mountedScenes(runtime.scene, runtime.local, profile.motion === 'reduced');
      if (mountSignature !== mounted.join(',')) { mountSignature = mounted.join(','); setResident(mounted); }
      const patch = sceneRegistrations.find(entry => entry.id === runtime.scene)?.sample?.(runtime.snapshot);
      if (patch) {
        const state = useExperienceStore.getState();
        if (Object.entries(patch).some(([key, value]) => state[key as keyof typeof state] !== value)) useExperienceStore.setState(patch);
      }
      window.dispatchEvent(new CustomEvent('nami:s04-progress', { detail: runtime.scene === 's04' && (runtime.local >= .9 || profile.motion === 'reduced') }));
      if (runtime.scene !== 's04' && runtime.exploration.active) { runtime.exploration.exit(); window.dispatchEvent(new CustomEvent('nami:explore-state', { detail: false })); }
      const camera = runtime.transitionContext.intents?.camera ?? boundary.camera;
      rig.setPoses(camera.from, camera.to, { blend: camera.blend, snap: snap || runtime.scene === 's01' || runtime.scene === 's05' || profile.motion === 'reduced' });
      if (useExperienceStore.getState().scene !== runtime.scene) useExperienceStore.setState({ scene: runtime.scene, robotState: runtime.snapshot.robot });
      acquire();
    }
    const controller = createController(runtime, sample, profile.motion === 'reduced', mobile);
    controller.attach();
    useExperienceStore.setState({ controller });
    let directorToken: number | null = null;
    function directorInteraction(event: Event) {
      if ((event as CustomEvent<boolean>).detail) directorToken = runtime.interaction.request('director');
      else if (directorToken !== null) { runtime.interaction.release(directorToken); directorToken = null; }
    }
    window.addEventListener('nami:director', directorInteraction);
    let modalToken: number | null = null;
    function timeMachineInteraction(event: Event) {
      if ((event as CustomEvent<boolean>).detail) modalToken = runtime.interaction.request('modal');
      else if (modalToken !== null) {
        runtime.interaction.release(modalToken);
        modalToken = null;
        if (useExperienceStore.getState().director !== 'idle') directorToken = runtime.interaction.request('director');
      }
    }
    window.addEventListener('nami:time-machine-interaction', timeMachineInteraction);
    if (useExperienceStore.getState().director !== 'idle') directorToken = runtime.interaction.request('director');
    if (typeof window !== 'undefined') (window as unknown as { __namiController?: typeof controller }).__namiController = controller;
    function seekStation(event: Event) {
      const local = (event as CustomEvent<number>).detail;
      if (Number.isFinite(local)) controller.seek('s03', local);
    }
    window.addEventListener('nami:station-seek', seekStation);
    function onRobotReact(event: Event) {
      const detail = (event as CustomEvent<{ name: 'React' | 'nod' | 'tilt'; duration?: number }>).detail;
      if (detail && detail.name) {
        runtime.interaction.react(detail.name, runtime.time, detail.duration ?? 0.9);
      }
    }
    window.addEventListener('nami:robot-react', onRobotReact);
    function seekProject(event: Event) {
      const local = (event as CustomEvent<number>).detail;
      if (Number.isFinite(local)) controller.seek('s05', local);
    }
    window.addEventListener('nami:project-seek', seekProject);
    function explore(event: Event) {
      const d = (event as CustomEvent).detail;
      if (runtime.scene !== 's04') return;
      if (d.action === 'enter') { if (runtime.exploration.enter()) window.dispatchEvent(new CustomEvent('nami:explore-state', { detail: true })); }
      else if (d.action === 'exit') { runtime.exploration.exit(); runtime.replayStart = null; sample(true); window.dispatchEvent(new CustomEvent('nami:explore-state', { detail: false })); }
      else if (runtime.exploration.active && d.action === 'orbit') { runtime.orbit.yaw += d.x; runtime.orbit.pitch = Math.max(-1.2, Math.min(1.2, runtime.orbit.pitch + d.y)); }
      else if (runtime.exploration.active && d.action === 'zoom') runtime.orbit.distance = Math.max(2, Math.min(8, runtime.orbit.distance + d.amount));
      else if (runtime.exploration.active && d.action === 'replay' && profile.motion === 'full') runtime.replayStart = runtime.time;
      else if (runtime.exploration.active && d.action === 'layer') {
        const names: Record<string, string[]> = { frame: ['Frame'], internals: ['BackPlate', 'Buttons', 'Board', 'Battery', 'Speaker', 'CameraModule'], glass: ['Glass'], display: ['Display'] };
        const root = contexts.get('s04')?.root; for (const name of names[d.key] ?? []) { const node = root?.getObjectByName(name); if (node) node.visible = d.visible; }
      }
    }
    window.addEventListener('nami:explore', explore);
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
        transition: runtime.transition ? { id: runtime.transition.id, progress: runtime.transition.progress } : null,
        mountedScenes: [...contexts.keys()].sort(),
      });
    }
    return () => {
      cancelled = true;
      controller.detach();
      window.removeEventListener('nami:director', directorInteraction);
      window.removeEventListener('nami:time-machine-interaction', timeMachineInteraction);
      if (modalToken !== null) runtime.interaction.release(modalToken);
      if (directorToken !== null) runtime.interaction.release(directorToken);
      useExperienceStore.setState({ controller: null });
      if (typeof window !== 'undefined') delete (window as unknown as { __namiController?: typeof controller }).__namiController;
      window.removeEventListener('nami:station-seek', seekStation);
      window.removeEventListener('nami:robot-react', onRobotReact);
      window.removeEventListener('nami:project-seek', seekProject);
      window.removeEventListener('nami:explore', explore);
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
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || new URLSearchParams(location.search).get('debug') !== 'transitions') return;
    let dispose: (() => void) | undefined;
    let cancelled = false;
    void import('./transitions/debug').then(({ transitionDebug }) => {
      if (!cancelled) dispose = transitionDebug(runtime);
    });
    return () => { cancelled = true; dispose?.(); };
  }, [runtime]);

  if (renderer === 'fallback') return null;
  return <><canvas ref={energyLine} data-s01-energy-line className={styles.energyLine} aria-hidden="true" /><CanvasBoundary><Canvas className={styles.canvas} data-scene-canvas dpr={dpr} gl={{ antialias: profile.quality === 'high', alpha: true }} onCreated={onCreated} fallback={null}>
    <ambientLight intensity={1.6} />
    <directionalLight position={[3, 4, 5]} intensity={2} />
    {sceneRegistrations.map(({ id, Component }) => resident.includes(id) && <Component key={id} register={register} residency={services?.residency ?? null} onError={fallback} />)}
    <IntroFrame runtime={runtime} profile={profile} />
    {services && <Robot runtime={runtime} profile={profile} residency={services.residency} onError={fallback} />}
    <Frame runtime={runtime} rig={rig} contexts={contexts} onFramed={onFramed} energyLine={energyLine} />
  </Canvas></CanvasBoundary></>;
}
