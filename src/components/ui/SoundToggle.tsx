'use client';

import { useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';
import { getAudioEngine, SOUND_EVENT } from '../../audio';
import styles from './SoundToggle.module.css';

function subscribe(callback: () => void): () => void {
  window.addEventListener(SOUND_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(SOUND_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

function getSnapshot(): boolean {
  return getAudioEngine().isEnabled();
}

function getServerSnapshot(): boolean {
  return false;
}

export function SoundToggle() {
  const t = useTranslations('Sound');
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  async function toggle() {
    const engine = getAudioEngine();
    await engine.toggleSound();
  }

  return (
    <button
      type="button"
      className={styles.toggle}
      aria-pressed={enabled}
      aria-label={t('label')}
      data-sound="click"
      onClick={toggle}
    >
      <span className={styles.icon} aria-hidden="true">
        {enabled ? '🔊' : '🔇'}
      </span>
      <span className={styles.label}>{enabled ? t('soundOn') : t('soundOff')}</span>
    </button>
  );
}
