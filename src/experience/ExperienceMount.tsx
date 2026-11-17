'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { browserEnvironment, detectProfile, initialDpr, readMotionChoice, effectiveMotion, MOTION_EVENT, type Profile } from './profile';
import { useExperienceStore } from './store';
import { sceneFromHash } from './controller';
import styles from './experience.module.css';

const Host = dynamic(() => import('./Host'), { ssr: false });

export default function ExperienceMount() {
  const [configuration, setConfiguration] = useState<{ profile: Profile; mobile: boolean; dpr: number } | null>(null);
  const scene = useExperienceStore(state => state.scene);
  const ready = useExperienceStore(state => state.ui.ready);
  const posterScene = useExperienceStore(state => state.ui.posterScene ?? state.scene);
  const renderer = useExperienceStore(state => state.profile.renderer);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    function motionChanged() {
      const motion = effectiveMotion(media.matches, readMotionChoice(localStorage));
      document.documentElement.dataset.motion = motion;
      useExperienceStore.setState(state => ({ profile: { ...state.profile, motion } }));
      setConfiguration(current => current ? { ...current, profile: { ...current.profile, motion } } : current);
    }
    function start() {
      const environment = browserEnvironment();
      const profile = detectProfile(environment);
      profile.motion = effectiveMotion(environment.reducedMotion, readMotionChoice(localStorage));
      document.documentElement.dataset.motion = profile.motion;
      useExperienceStore.setState({ profile, scene: sceneFromHash(location.hash) ?? 's01' });
      setConfiguration({ profile, mobile: environment.coarsePointer, dpr: initialDpr(environment.coarsePointer) });
      media.addEventListener('change', motionChanged);
      window.addEventListener(MOTION_EVENT, motionChanged);
    }
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(start, { timeout: 1200 });
      return () => { window.cancelIdleCallback(id); media.removeEventListener('change', motionChanged); window.removeEventListener(MOTION_EVENT, motionChanged); };
    }
    const id = setTimeout(start, 100);
    return () => { clearTimeout(id); media.removeEventListener('change', motionChanged); window.removeEventListener(MOTION_EVENT, motionChanged); };
  }, []);
  useEffect(() => {
    // Literal environment checks let Next remove the import from normal production builds.
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_DEBUG_TOOLS !== '1') return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    void import('./debug/reference').then(({ referenceOverlay }) => {
      if (!cancelled) dispose = referenceOverlay();
    });
    return () => { cancelled = true; dispose?.(); };
  }, []);
  return <div className={styles.host} data-experience data-scene={scene} data-ready={ready} data-renderer={renderer} aria-hidden="true">
    <div className={`${styles.poster} ${ready ? styles.hidden : ''}`} style={configuration ? { backgroundImage: `url(/posters/${posterScene}.svg)` } : undefined}>
      {!configuration && <svg width="100%" height="100%" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid meet">
        <ellipse cx="600" cy="655" rx="120" ry="12" fill="#f6f7f8" />
        <path d="M535 436 Q520 600 600 620 Q680 600 665 436Z" fill="#f6f7f8" stroke="#d9dcdf" strokeWidth="3" />
        <rect x="478" y="251" width="244" height="182" rx="65" fill="#f6f7f8" stroke="#d9dcdf" strokeWidth="3" />
        <rect x="495" y="280" width="210" height="128" rx="45" fill="#1b1d20" />
        <g fill="#009f6f"><rect x="535" y="322" width="40" height="23" rx="10" /><rect x="625" y="322" width="40" height="23" rx="10" /></g>
      </svg>}
    </div>
    {configuration && <Host {...configuration} />}
  </div>;
}
