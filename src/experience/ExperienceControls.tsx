'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { directorDuration, directorReducer, nextDirectorScene } from './director';
import { createFactory } from './factory';
import { useExperienceStore } from './store';
import styles from './controls.module.css';

export function ExperienceControls({ services }: { services: string[] }) {
  const t = useTranslations('ExperienceControls');
  const pathname = usePathname();
  const director = useExperienceStore(state => state.director);
  const active = director !== 'idle';
  const scene = useExperienceStore(state => state.scene);
  const motion = useExperienceStore(state => state.profile.motion);
  const [factory, setFactory] = useState(false);
  const [factoryState] = useState(createFactory);
  const entry = useRef<HTMLButtonElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const setDirector = (action: Parameters<typeof directorReducer>[1]) => useExperienceStore.setState(state => ({ director: directorReducer(state.director, action, state.profile.motion === 'reduced') }));
  function next() {
    const state = useExperienceStore.getState();
    const target = nextDirectorScene(state.scene);
    if (!target) { setDirector('exit'); return; }
    if (state.controller) state.controller.seek(target, 0, false);
    else document.getElementById(target)?.scrollIntoView({ behavior: 'instant' });
  }
  useEffect(() => {
    if (director !== 'playing') return;
    const timer = setTimeout(next, directorDuration(scene));
    return () => clearTimeout(timer);
  // Scene changes restart the dwell period.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [director, scene]);
  useEffect(() => {
    if (!active) return;
    window.dispatchEvent(new CustomEvent('nami:director', { detail: true }));
    function manual(event: Event) { if (event.target instanceof Element && event.target.closest('[data-time-machine]')) return; setDirector('manual'); window.scrollTo({ top: window.scrollY, behavior: 'instant' }); }
    function key(event: KeyboardEvent) { if (event.key === 'Escape' || (!(event.target instanceof Element && event.target.closest('button, a, input, textarea, select')) && ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key))) manual(event); }
    window.addEventListener('wheel', manual, { passive: true });
    window.addEventListener('touchstart', manual, { passive: true });
    window.addEventListener('keydown', key);
    return () => { window.dispatchEvent(new CustomEvent('nami:director', { detail: false })); window.removeEventListener('wheel', manual); window.removeEventListener('touchstart', manual); window.removeEventListener('keydown', key); };
  }, [active]);
  useEffect(() => {
    if (!factory) return;
    const previous = document.body.style.overflow;
    const opener = entry.current;
    document.body.style.overflow = 'hidden';
    close.current?.focus();
    function key(event: KeyboardEvent) { if (event.key === 'Escape') setFactory(false); }
    function focus(event: FocusEvent) { if (event.target instanceof Node && !dialog.current?.contains(event.target)) setFactory(false); }
    window.addEventListener('keydown', key);
    document.addEventListener('focusin', focus);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', key); document.removeEventListener('focusin', focus); const saved = factoryState.close(); if (opener?.isConnected && saved) { const controller = useExperienceStore.getState().controller; if (controller) controller.seek(saved.scene, saved.local, false); else window.scrollTo({ top: saved.scrollY, behavior: 'instant' }); opener.focus({ preventScroll: true }); } };
  }, [factory, factoryState]);
  useEffect(() => () => { useExperienceStore.setState({ director: 'idle' }); }, [pathname]);
  const controls = <div className={styles.controls} data-director={director}>
      {director === 'idle' ? <button type="button" onClick={() => setDirector('start')}>{t('start')}</button> : <>
        {motion !== 'reduced' && <button type="button" onClick={() => { if (director === 'playing') window.scrollTo({ top: window.scrollY, behavior: 'instant' }); setDirector(director === 'playing' ? 'pause' : 'resume'); }}>{t(director === 'playing' ? 'pause' : 'resume')}</button>}
        <button type="button" onClick={next}>{t(director === 'step' ? 'next' : 'skip')}</button>
        <button type="button" onClick={() => { window.scrollTo({ top: window.scrollY, behavior: 'instant' }); setDirector('exit'); }}>{t('exit')}</button>
      </>}
    </div>;
  return <>
    {active ? createPortal(controls, document.body) : controls}
    <button ref={entry} type="button" className={styles.factoryEntry} aria-label={t('factoryOpen')} onClick={() => { window.scrollTo({ top: window.scrollY, behavior: 'instant' }); const state = useExperienceStore.getState(); const position = state.controller?.position?.() ?? { scene: state.scene, local: 0 }; factoryState.open({ ...position, scrollY: window.scrollY }); setDirector('exit'); setFactory(true); }}>✦</button>
    {factory && createPortal(<div ref={dialog} className={styles.factory} data-motion={motion} role="dialog" aria-modal="true" aria-label={t('factoryTitle')} onClick={event => { if (event.target === event.currentTarget) setFactory(false); }}>
      <button ref={close} type="button" onClick={() => setFactory(false)}>{t('factoryClose')}</button>
      <h2>{t('factoryTitle')}</h2>
      <ol>{services.map(service => <li key={service}>{service}</li>)}</ol>
    </div>, document.body)}
  </>;
}
