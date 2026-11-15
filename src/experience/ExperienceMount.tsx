'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { browserEnvironment, detectProfile, initialDpr, type Profile } from './profile';
import { useExperienceStore } from './store';
import { sceneFromHash } from './controller';
import styles from './experience.module.css';

const Host = dynamic(() => import('./Host'), { ssr: false });

export default function ExperienceMount() {
  const [configuration, setConfiguration] = useState<{ profile: Profile; mobile: boolean; dpr: number } | null>(null);
  const scene = useExperienceStore(state => state.scene);
  const ready = useExperienceStore(state => state.ui.ready);
  const renderer = useExperienceStore(state => state.profile.renderer);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    function motionChanged() {
      const motion = media.matches ? 'reduced' : 'full';
      useExperienceStore.setState(state => ({ profile: { ...state.profile, motion } }));
      setConfiguration(current => current ? { ...current, profile: { ...current.profile, motion } } : current);
    }
    function start() {
      const environment = browserEnvironment();
      const profile = detectProfile(environment);
      useExperienceStore.setState({ profile, scene: sceneFromHash(location.hash) ?? 's01' });
      setConfiguration({ profile, mobile: environment.coarsePointer, dpr: initialDpr(environment.coarsePointer) });
      media.addEventListener('change', motionChanged);
    }
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(start, { timeout: 1200 });
      return () => { window.cancelIdleCallback(id); media.removeEventListener('change', motionChanged); };
    }
    const id = setTimeout(start, 100);
    return () => { clearTimeout(id); media.removeEventListener('change', motionChanged); };
  }, []);
  return <div className={styles.host} data-experience data-scene={scene} data-ready={ready} data-renderer={renderer} aria-hidden="true">
    <div className={`${styles.poster} ${ready ? styles.hidden : ''}`} style={configuration ? { backgroundImage: `url(/posters/${scene}.svg)` } : undefined}>
      {!configuration && <svg width="100%" height="100%" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid meet"><path d="M600 220 760 310 760 490 600 580 440 490 440 310Z" fill="#397d8d" /></svg>}
    </div>
    {configuration && <Host {...configuration} />}
  </div>;
}
