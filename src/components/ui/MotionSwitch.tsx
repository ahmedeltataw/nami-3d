'use client';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { MOTION_EVENT, readMotionChoice, saveMotionChoice, type MotionChoice } from '@/experience/profile';
import styles from './MotionSwitch.module.css';

export function MotionSwitch() {
  const t = useTranslations('Motion');
  const [choice, setChoice] = useState<MotionChoice>('cinematic');
  useEffect(() => {
    function sync() { setChoice(readMotionChoice(localStorage)); }
    sync();
    window.addEventListener(MOTION_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(MOTION_EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  function change(value: MotionChoice) {
    setChoice(value);
    saveMotionChoice(localStorage, value);
    window.dispatchEvent(new Event(MOTION_EVENT));
  }
  return <fieldset className={styles.switch}><legend>{t('label')}</legend>{(['cinematic', 'direct'] as const).map(value =>
    <button type="button" key={value} aria-pressed={choice === value} onClick={() => change(value)}>{t(value)}</button>
  )}</fieldset>;
}
