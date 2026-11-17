'use client';

import { useExperienceStore } from '@/experience/store';
import styles from './SkipIntro.module.css';

export function SkipIntro({ label }: { label: string }) {
  const controller = useExperienceStore(state => state.controller);

  const handleClick = () => {
    const activeController = controller ?? (typeof window !== 'undefined' ? (window as unknown as { __namiController?: { seek: (scene: string, local?: number) => void } }).__namiController : null);
    if (activeController?.seek) {
      if ('hero' in activeController && typeof activeController.hero === 'function') activeController.hero('s02');
      else activeController.seek('s02', 0);
    }
  };

  return (
    <button type="button" className={styles.skipIntro} onClick={handleClick}>
      {label}
    </button>
  );
}
