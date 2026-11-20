'use client';

/* eslint-disable react-hooks/immutability -- R3F owns this imperative runtime; it is never React state. */
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Canvas, useFrame, useThree, type RootState } from '@react-three/fiber';
import { usePathname } from 'next/navigation';
import { Color, SRGBColorSpace, Matrix4, Quaternion, Vector3, type PerspectiveCamera } from 'three';
import type { Ctx, Profile, SceneId } from './contracts';
import { createController, SCENE_IDS } from './controller';
import { createRuntime, evaluateRuntime, syncRuntimeProfile, type ExperienceRuntime } from './runtime';
import { noJumps } from './profile';
import { CameraRig } from './camera/CameraRig';
import { useExperienceStore } from './store';
import { scenes } from './scenes';
import { sceneRegistrations } from './scenes/registration';
import { drawEnergyLine } from './scenes/s01/headline';
import { createAssetLoader } from './assets/loaders';
import { AssetResidency, keysForScene, worldKeys } from './assets/residency';
import { mountedScenes, residentScenes, transitions } from './transitions';
import { TransitionResidency } from './transitions/residency';
import { Robot } from './robot/Robot';
import { createHeadReaction, pointerNearHead } from './robot/procedural';
import styles from './experience.module.css';
import { gsap } from 'gsap';
import { captureTimes } from './clocks';
import { RuntimeContext } from './RuntimeContext';
import { applyOverlayFrame } from './overlays';
import { beatsFor, readinessPresentation } from './transitions/beats';
import { ScenePresentation, TransportChannels } from './presentation';
import { SceneLighting } from './lighting/SceneLighting';
import { LightingController } from './lighting/controller';
import type { LightingPost } from './lighting/post';

type Services = ReturnType<typeof createAssetLoader> & { residency: AssetResidency; gl: RootState['gl']; scene: RootState['scene']; camera: RootState['camera'] };

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

function publishOwner(runtime: ExperienceRuntime) {
  const owner = runtime.transition?.owner ?? runtime.scene;
  const snapshot = runtime.sceneSnapshots[owner] ?? runtime.snapshot;
  if (!snapshot) return;
  const patch = sceneRegistrations.find(entry => entry.id === owner)?.sample?.(snapshot) ?? {};
  const state = useExperienceStore.getState();
  if (state.scene !== owner) Object.assign(patch, { scene: owner, robotState: snapshot.robot });
  if (Object.entries(patch).some(([key, value]) => state[key as keyof typeof state] !== value)) useExperienceStore.setState(patch);
}
function sampleRuntime(runtime: ExperienceRuntime) {
  const { station, project } = useExperienceStore.getState();
  runtime.selection = { station, project };
  const boundary = evaluateRuntime(runtime);
  publishOwner(runtime);
  return boundary;
}

function SampleFrame({ runtime }: { runtime: ExperienceRuntime }) {
  useFrame((state, delta) => {
    if (runtime.contextLost) return;
    runtime.time = state.clock.elapsedTime;
    runtime.clocks.tick(delta, runtime.profile.motion === 'reduced', runtime.robotReady && runtime.assetsReady && !runtime.intro.cancelled && runtime.scene === 's01');
    sampleRuntime(runtime);
  }, -2);
  return null;
}

function Frame({ runtime, rig, contexts, onFramed, energyLine, lighting, post }: {
  runtime: ExperienceRuntime;
  rig: CameraRig;
  contexts: Map<SceneId, Ctx>;
  onFramed: () => void;
  energyLine: RefObject<HTMLCanvasElement | null>;
  lighting: LightingController;
  post: RefObject<LightingPost | null>;
}) {
  const camera = useThree(state => state.camera) as PerspectiveCamera;
  const gaze = useMemo(() => new Vector3(), []);
  const orbitPosition = useMemo(() => new Vector3(), []);
  const transport = useMemo(() => new TransportChannels(), []);
  const scenePresentation = useMemo(() => new ScenePresentation(), []);
  const warmState = useMemo(() => ({ version: -1, contexts: new WeakSet<Ctx>() }), []);
  const color = useMemo(() => new Color(), []);
  useEffect(() => () => scenePresentation.restore(), [scenePresentation]);
  const orbitTarget = useMemo(() => new Vector3(.82, 0, 0), []);
  useFrame((state, delta) => {
    if (runtime.contextLost) return;
    runtime.interaction.tick(runtime.time);
    scenePresentation.restore();
    if (warmState.version !== runtime.contextVersion) { warmState.version = runtime.contextVersion; warmState.contexts = new WeakSet(); }
    const warmed = warmState.contexts;
    const transition = runtime.transition;
    const intents = runtime.transitionContext.intents;
    if (runtime.assetsReady && runtime.robotReady) {
      const previous = [...contexts.values()].map(ctx => [ctx, ctx.root.visible] as const);
      for (const [ctx] of previous) {
        if (warmed.has(ctx)) continue;
        for (const [other] of previous) other.root.visible = other === ctx;
        const id = [...contexts].find(([, context]) => context === ctx)![0];
        const robot = state.scene.getObjectByName('robot');
        lighting.update(id, null, state.scene, robot ? [ctx.root, robot] : [ctx.root]);
        if (!post.current) continue;
        post.current.compile(robot ? [ctx.root, robot, transport.portal] : [ctx.root, transport.portal]);
        warmed.add(ctx);
      }
      for (const [ctx, visible] of previous) ctx.root.visible = visible;
    }
    const ownerContext = contexts.get(intents?.owner ?? runtime.scene);
    const ready = runtime.assetsReady && runtime.robotReady && !!ownerContext && warmed.has(ownerContext);
    const presentation = readinessPresentation(transition?.progress ?? null, ready, runtime.coldSeek, transition ? beatsFor(transition.id) : undefined);
    runtime.loading = presentation.hold;
    applyOverlayFrame(runtime.scene, runtime.b, transition, runtime.loading, noJumps(runtime.profile), { s01: runtime.sceneSnapshots.s01?.visual, s02: runtime.sceneSnapshots.s02?.visual });
    runtime.presentationSnapshot = presentation.poster && transition ? scenes[transition.owner].sample({ local: 0, viewport: runtime.viewport, profile: runtime.profile, interaction: runtime.interaction.state, ambient: runtime.clocks.value.ambientTime, ambientWeight: 0, seed: 1 }) : null;
    if (runtime.presentationSnapshot) {
      const hero = runtime.presentationSnapshot.camera;
      rig.setPoses(hero, hero, { blend: 1, snap: true });
    } else {
      const pose = intents?.camera ?? (runtime.snapshot ? { from: runtime.snapshot.camera, to: runtime.snapshot.camera, blend: 1 } : null);
      if (pose && !runtime.exploration.active) rig.setPoses(pose.from, pose.to, { blend: pose.blend, snap: true });
    }
    if (runtime.exploration.active && runtime.scene === 's04' && runtime.snapshot) {
      const o = runtime.orbit;
      orbitPosition.set(orbitTarget.x + Math.sin(o.yaw) * Math.cos(o.pitch) * o.distance, Math.sin(o.pitch) * o.distance, Math.cos(o.yaw) * Math.cos(o.pitch) * o.distance);
      const q = new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(orbitPosition, orbitTarget, new Vector3(0, 1, 0)));
      const pose = { ...runtime.snapshot.camera, position: orbitPosition.toArray() as [number, number, number], quaternion: q.toArray() as [number, number, number, number] };
      rig.setPoses(pose, pose, { blend: 1, snap: false });
    }
    rig.apply(camera, delta);
    runtime.cameraZ = camera.position.z;
    for (let index = 0; index < SCENE_IDS.length; index++) {
      const id = SCENE_IDS[index];
      const ctx = contexts.get(id);
      if (!ctx) continue;
      const visibility = transition && id === transitions[transition.id].from ? intents?.fromVisibility ?? 0
        : transition && id === transitions[transition.id].to ? intents?.toVisibility ?? 0 : Number(id === runtime.scene);
      const owner = intents?.owner ?? runtime.scene;
      const ready = runtime.assetsReady || (id === runtime.scene && runtime.framed);
      ctx.visibility = visibility;
      ctx.transition = intents;
      ctx.root.visible = ready && visibility > 0 && id === owner;
      const snapshot = id === owner && runtime.presentationSnapshot ? runtime.presentationSnapshot : runtime.sceneSnapshots[id] ?? (id === runtime.scene ? runtime.snapshot : null);
      if (ctx.root.visible && snapshot) {
        ctx.ambient = runtime.clocks.value.ambientTime;
        ctx.ambientWeight = runtime.ambientWeight;
        scenes[id].apply(snapshot, ctx);
        const directive = runtime.transitionContext.intents?.robot.directive ?? runtime.snapshot?.robot;
        if (id !== owner) { ctx.beforeRender?.(camera); continue; }
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
    const background = intents?.background ?? runtime.snapshot?.visual.background as [number, number, number] | undefined;
    state.scene.background = background ? color.setRGB(...background, SRGBColorSpace) : null;
    transport.apply(intents);

    if (runtime.assetsReady && runtime.robotReady && contexts.has(runtime.scene) && !runtime.framed) {
      runtime.framed = true;
      requestAnimationFrame(onFramed);
    }
  }, -1);
  useFrame(() => {
    const visual = runtime.snapshot?.visual;
    const line = energyLine.current;
    const reveal = runtime.scene === 's01' ? Number(visual?.line ?? 0) : 0;
    if (line) {
      line.style.opacity = reveal > 0 && reveal < 1 ? '1' : '0';
      const headline = document.querySelector('[data-s01-headline]')?.getBoundingClientRect();
      if (headline) drawEnergyLine(line, headline, runtime.handScreen, reveal, document.documentElement.dir === 'rtl', runtime.viewport.dpr);
    }
    const transition = runtime.transition;
    const intents = runtime.transitionContext.intents;
    for (const [id, ctx] of contexts) {
      if (!ctx.root.visible) continue;
      const lightWeight = !transition ? 1 : id === transitions[transition.id].from ? intents!.lights.aWeight : intents!.lights.bWeight;
      scenePresentation.apply(ctx.root, ctx.visibility ?? 1, lightWeight, !!intents && intents.wash >= 1);
    }
  }, 1);
  return <primitive object={transport.portal} />;
}

export default function Host({ profile, mobile, dpr }: { profile: Profile; mobile: boolean; dpr: number }) {
  const renderer = useExperienceStore(state => state.profile.renderer);
  const runtime = useMemo(() => createRuntime(), []);
  syncRuntimeProfile(runtime, profile, renderer);
  const rig = useMemo(() => new CameraRig(), []);
  const lighting = useMemo(() => new LightingController(), []);
  const post = useRef<LightingPost | null>(null);
  const contexts = useMemo(() => new Map<SceneId, Ctx>(), []);
  const energyLine = useRef<HTMLCanvasElement>(null);
  const canReact = useMemo(() => createHeadReaction(), []);
  const [services, setServices] = useState<Services | null>(null);
  const [resident, setResident] = useState<SceneId[]>(['s01']);
  const pathname = usePathname();
  const attachedPath = useRef<string | null>(null);
  const register = useCallback((id: SceneId, ctx: Ctx | null) => {
    if (ctx) { ctx.reducedMotion = useExperienceStore.getState().profile.motion === 'reduced'; contexts.set(id, ctx); }
    else contexts.delete(id);
    lighting.invalidateMaterials();
  }, [contexts, lighting]);
  const onFramed = useCallback(() => {
    if (runtime.framed && !runtime.contextLost && runtime.assetsReady) useExperienceStore.setState({ ui: { ready: true, contextLost: false } });
  }, [runtime]);
  const onCreated = useCallback((state: RootState) => {
    const loader = createAssetLoader(state.gl);
    setServices({ ...loader, gl: state.gl, scene: state.scene, camera: state.camera, residency: new AssetResidency(loader.load, profile.quality) });
  }, [profile.quality]);

  useEffect(() => {
    runtime.viewport.dpr = dpr;
    for (const ctx of contexts.values()) ctx.reducedMotion = profile.motion === 'reduced';
    let cancelled = false;
    let assetSignature = '';
    let mountSignature = '';
    let previousProgress = runtime.progress;
    let replayTween: gsap.core.Timeline | null = null;
    runtime.clocks.setCapture(captureTimes(location.search));
    window.__namiCapture = times => { runtime.clocks.setCapture(times); sampleRuntime(runtime); };
    const assets = services ? new TransitionResidency(services.residency) : null;
    function release(evict = false) {
      assets?.release();
      assetSignature = '';
      if (evict) services?.residency.evictUnused();
    }
    function acquire() {
      if (!services || runtime.contextLost || renderer === 'fallback') return;
      const jumpsDisabled = noJumps(runtime.profile);
      const mounted = mountedScenes(runtime.scene, runtime.narrativeLocal, jumpsDisabled);
      const projectFor = (id: SceneId) => Number(runtime.sceneSnapshots[id]?.visual.project ?? useExperienceStore.getState().project);
      // Active destination comes first on cold seeks; the other scene is acquired before any release.
      const ordered = [runtime.scene, ...mounted.filter(id => id !== runtime.scene)];
      const required = ordered.flatMap(id => keysForScene(id, projectFor(id)).filter(key => id === runtime.scene || !key.startsWith('poster:')));
      const warm = residentScenes(runtime.scene, runtime.narrativeLocal, jumpsDisabled, runtime.direction).filter(id => !mounted.includes(id))
        .flatMap(id => keysForScene(id, id === 's05' && runtime.scene === 's06' ? 5 : 0).filter(key => !key.startsWith('poster:')));
      if (mounted.includes('s05')) warm.push(...worldKeys(projectFor('s05'), true));
      const signature = `${required.join(',')}|${warm.join(',')}`;
      if (assetSignature === signature) return;
      assetSignature = signature;
      runtime.assetsReady = required.every(key => services.residency.isResident(key));
      if (!runtime.assetsReady && (!runtime.framed || runtime.coldSeek)) {
        runtime.framed = false;
        useExperienceStore.setState({ ui: { ready: false, contextLost: false, posterScene: runtime.transition?.owner ?? runtime.scene } });
      }
      assets?.update(required, warm, () => {
        if (!cancelled && !runtime.contextLost) runtime.assetsReady = true;
      }, error => { if (!cancelled && error instanceof Error && error.name !== 'AbortError') fallback(); });
    }
    function sample(snap: boolean) {
      if (runtime.local > 0 || runtime.scene !== 's01' || profile.motion === 'reduced') runtime.intro.cancel();
      if (runtime.progress !== previousProgress) {
        runtime.direction = runtime.progress >= previousProgress ? 1 : -1;
        previousProgress = runtime.progress;
        replayTween?.kill(); runtime.replay.active = false;
        if (runtime.exploration.active) { runtime.exploration.exit(); window.dispatchEvent(new CustomEvent('nami:explore-state', { detail: false })); }
      }
      runtime.coldSeek = snap;
      const boundary = sampleRuntime(runtime);
      const mounted = mountedScenes(runtime.scene, runtime.narrativeLocal, noJumps(runtime.profile));
      if (mountSignature !== mounted.join(',')) { mountSignature = mounted.join(','); setResident(mounted); }
      window.dispatchEvent(new CustomEvent('nami:s04-progress', { detail: runtime.scene === 's04' && (runtime.b >= .9 || profile.motion === 'reduced') }));
      if (runtime.scene !== 's04' && runtime.exploration.active) { runtime.exploration.exit(); window.dispatchEvent(new CustomEvent('nami:explore-state', { detail: false })); }
      const camera = runtime.transitionContext.intents?.camera ?? boundary.camera;
      rig.setPoses(camera.from, camera.to, { blend: camera.blend, snap: true });
      acquire();
      runtime.loading = !!runtime.transition && (runtime.loading || readinessPresentation(runtime.transition.progress, runtime.assetsReady && runtime.robotReady, runtime.coldSeek, beatsFor(runtime.transition.id)).hold);
      applyOverlayFrame(runtime.scene, runtime.b, runtime.transition, runtime.loading, noJumps(runtime.profile), { s01: runtime.sceneSnapshots.s01?.visual, s02: runtime.sceneSnapshots.s02?.visual });
    }
    const controller = createController(runtime, sample, profile.motion === 'reduced', mobile);
    controller.attach(attachedPath.current !== pathname);
    attachedPath.current = pathname;
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
      if (detail && detail.name && !runtime.transition && !runtime.clocks.capture) {
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
      else if (d.action === 'exit') { runtime.exploration.exit(); replayTween?.kill(); runtime.replay.active = false; sample(true); window.dispatchEvent(new CustomEvent('nami:explore-state', { detail: false })); }
      else if (runtime.exploration.active && d.action === 'orbit') { runtime.orbit.yaw += d.x; runtime.orbit.pitch = Math.max(-1.2, Math.min(1.2, runtime.orbit.pitch + d.y)); }
      else if (runtime.exploration.active && d.action === 'zoom') runtime.orbit.distance = Math.max(2, Math.min(8, runtime.orbit.distance + d.amount));
      else if (runtime.exploration.active && d.action === 'replay') {
        replayTween?.kill();
        runtime.replay.b = .1; runtime.replay.active = true;
        replayTween = gsap.timeline({ onComplete: () => { runtime.replay.active = false; } })
          .to(runtime.replay, { b: .6, duration: profile.motion === 'reduced' ? 0 : 3.1, ease: 'none' })
          .to(runtime.replay, { b: runtime.b, duration: profile.motion === 'reduced' ? 0 : .4, ease: 'power2.inOut' });
      }
      else if (runtime.exploration.active && d.action === 'layer') {
        const names: Record<string, string[]> = { frame: ['Frame'], internals: ['BackPlate', 'Buttons', 'Board', 'Battery', 'Speaker', 'CameraModule'], glass: ['Glass'], display: ['Display'] };
        const root = contexts.get('s04')?.root; for (const name of names[d.key] ?? []) { const node = root?.getObjectByName(name); if (node) node.visible = d.visible; }
      }
    }
    window.addEventListener('nami:explore', explore);
    function lost(event: Event) {
      event.preventDefault();
      runtime.contextLost = true;
      runtime.contextVersion++;
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
        controller.hero('s01');
        return;
      }
      if (target.closest('a, button, input, select, textarea, [role="button"]') || event.button !== 0) return;
      if (!runtime.transition && !runtime.clocks.capture && runtime.scene === 's01' && profile.motion === 'full' && !runtime.interaction.state.source
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
        b: runtime.b, ambientTime: runtime.clocks.value.ambientTime, introTime: runtime.clocks.value.introTime, loading: runtime.loading, owner: runtime.transition?.owner ?? runtime.scene, snapshot: runtime.snapshot,
        scene: runtime.scene, local: runtime.local, progress: runtime.progress, cameraZ: runtime.cameraZ,
        introCancelled: runtime.intro.cancelled, robotReady: runtime.robotReady, robotMeshes: runtime.robotMeshes,
        head: { ...runtime.headScreen }, robot: runtime.snapshot ? { ...runtime.snapshot.robot } : undefined,
        reaction: runtime.interaction.state.reaction?.name,
        transition: runtime.transition ? { id: runtime.transition.id, progress: runtime.transition.progress } : null,
        mountedScenes: [...contexts.keys()].sort(),
      });
    }
    return () => {
      cancelled = true;
      replayTween?.kill();
      runtime.replay.active = false;
      delete window.__namiCapture;
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
  return <RuntimeContext value={runtime}><canvas ref={energyLine} data-s01-energy-line className={styles.energyLine} aria-hidden="true" /><CanvasBoundary><Canvas className={styles.canvas} data-scene-canvas dpr={dpr} gl={{ antialias: profile.quality === 'high', alpha: true }} onCreated={onCreated} fallback={null}>
    <SceneLighting scene={runtime.scene} lighting={lighting} post={post} />
    {sceneRegistrations.map(({ id, Component }) => resident.includes(id) && <Component key={id} register={register} residency={services?.residency ?? null} onError={fallback} />)}
    <SampleFrame runtime={runtime} />
    {services && <Robot runtime={runtime} profile={profile} residency={services.residency} onError={fallback} onSceneGraphChange={lighting.invalidateMaterials} />}
    <Frame runtime={runtime} rig={rig} contexts={contexts} onFramed={onFramed} energyLine={energyLine} lighting={lighting} post={post} />
  </Canvas></CanvasBoundary></RuntimeContext>;
}
