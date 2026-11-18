'use client';
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import type { SceneId, TransitionSnapshot } from './contracts';
import { useExperienceStore } from './store';
import { noJumps } from './profile';

type SceneTimeline = { node: HTMLElement; jump: HTMLElement; timeline: gsap.core.Timeline; jumpTimeline: gsap.core.Timeline; reveal?: gsap.core.Timeline; emphasis?: gsap.core.Timeline; hint?: gsap.core.Timeline };
export const overlayTimelines = new Map<SceneId, SceneTimeline>();
let washTimeline: gsap.core.Timeline | null = null;
let washNode: HTMLElement | null = null;

export function OverlayRoot() {
  const enabled = useExperienceStore(state => !noJumps(state.profile));
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      washNode = ref.current!.querySelector<HTMLElement>('[data-jump-wash]');
      washTimeline = gsap.timeline({ paused: true }).fromTo(washNode, { opacity: 0 }, { opacity: 1, duration: 1, ease: 'none' });
    }, ref);
    return () => { ctx.revert(); washTimeline = null; washNode = null; delete document.documentElement.dataset.jumpOpaque; };
  }, []);
  useLayoutEffect(() => {
    if (enabled) return;
    washTimeline?.progress(0, true);
    if (washNode) washNode.dataset.hold = 'false';
    const pulse = ref.current?.querySelector<HTMLElement>('[data-jump-loading]');
    if (pulse) pulse.hidden = true;
    delete document.documentElement.dataset.jumpOpaque;
  }, [enabled]);
  return <div ref={ref} id="nami-overlays" data-narrative-overlays>
    <div data-jump-wash aria-hidden="true" />
    <div data-jump-loading hidden role="status" aria-label="Loading"><span /></div>
  </div>;
}

export function SceneOverlay({ id, children }: { id: SceneId; children: ReactNode }) {
  const renderer = useExperienceStore(state => state.profile.renderer);
  const motion = useExperienceStore(state => state.profile.motion);
  const visibleScene = useExperienceStore(state => state.scene);
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const scene = useRef<HTMLDivElement>(null);
  const jump = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // The overlay target is an SSR sibling; publish it after hydration commits.
    let active = true;
    queueMicrotask(() => { if (active) setRoot(document.getElementById('nami-overlays')); });
    return () => { active = false; };
  }, []);
  const enhanced = !noJumps({ renderer, motion }) && !!root;
  useLayoutEffect(() => {
    if (!enhanced) return;
    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({ paused: true });
      let reveal: gsap.core.Timeline | undefined;
      let emphasis: gsap.core.Timeline | undefined;
      let hint: gsap.core.Timeline | undefined;
      if (id === 's01') {
        reveal = gsap.timeline({ paused: true }).fromTo(scene.current, { '--headline-reveal': '0%' }, { '--headline-reveal': '100%', duration: 1, ease: 'none' });
        emphasis = gsap.timeline({ paused: true }).fromTo(scene.current, { '--subtitle-emphasis': 0 }, { '--subtitle-emphasis': 1, duration: 1, ease: 'none' });
        hint = gsap.timeline({ paused: true }).fromTo(scene.current, { '--scroll-hint': 0 }, { '--scroll-hint': 1, duration: 1, ease: 'none' });
        timeline.fromTo('[data-s01-headline]', { opacity: 1, y: 0 }, { opacity: 0, y: -48, duration: .45, ease: 'none' }, .55);
      } else timeline.fromTo(scene.current, { opacity: 1 }, { opacity: 1, duration: 1 });
      const jumpTimeline = gsap.timeline({ paused: true })
        .fromTo(jump.current, { opacity: 1, y: 0 }, { opacity: 0, y: -16, duration: .25, ease: 'none' }, 0)
        .fromTo(jump.current, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .25, ease: 'none', immediateRender: false }, .75);
      overlayTimelines.set(id, { node: scene.current!, jump: jump.current!, timeline, jumpTimeline, reveal, emphasis, hint });
      reveal?.progress(1, true);
      applyOverlayFrame(useExperienceStore.getState().scene, 0, null, false, false);
    }, scene);
    return () => { overlayTimelines.delete(id); ctx.revert(); };
  }, [id, enhanced]);
  if (!enhanced) return children;
  return createPortal(<div hidden={id !== visibleScene} data-overlay-scene={id} data-projection-wrapper><div ref={scene} data-scene-timeline><div ref={jump} data-jump-opacity>{children}</div></div></div>, root!);
}

export function applyOverlayFrame(scene: SceneId, b: number, transition: TransitionSnapshot | null, loading: boolean, reduced: boolean, visuals?: Partial<Record<SceneId, Record<string, unknown>>>) {
  const t = transition?.ui.jumpProgress ?? 0;
  for (const [id, entry] of overlayTimelines) {
    const from = transition?.id.startsWith(`${id}->`) ?? false;
    const to = transition?.id.endsWith(`->${id}`) ?? false;
    const active = transition ? from || to : id === scene;
    entry.node.parentElement!.hidden = !active;
    entry.node.inert = !active || !!transition;
    entry.timeline.progress(reduced ? 0 : from ? transition!.ui.aProgress : to ? transition!.ui.bProgress : b, true);
    const visual = visuals?.[id];
    if (visual) {
      entry.reveal?.progress(Number(visual.headlineReveal ?? 100) / 100, true);
      entry.emphasis?.progress(Number(visual.subtitleEmphasis ?? 0), true);
      entry.hint?.progress(Number(visual.scrollHint ?? 1), true);
    }
    entry.jumpTimeline.progress(transition ? t : id === scene ? 1 : .5, true);
    // The projected anchor may only be shown under its own camera.
    entry.node.parentElement!.style.visibility = transition && transition.owner !== id ? 'hidden' : 'visible';
  }
  if (washTimeline && washNode) {
    washTimeline.progress(reduced ? 0 : loading ? 1 : transition?.wash ?? 0, true);
    // A hold covers any boundary, including overrides whose opaque interval differs.
    washNode.dataset.hold = String(loading && !reduced);
    document.documentElement.dataset.jumpOpaque = String(!reduced && (loading || (transition?.wash ?? 0) >= 1));
  }
  const pulse = document.querySelector<HTMLElement>('[data-jump-loading]');
  if (pulse) pulse.hidden = !loading || reduced;
}
