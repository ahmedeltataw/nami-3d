'use client';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { useExperienceStore } from '../store';
import { timelineIndex, type Milestone } from './timeline';
import styles from './time-machine.module.css';
import { createTimeMachineSession } from './session';

type Labels = { title: string; close: string; previous: string; next: string; slider: string; article: string; published: string; founded: string };
export function TimeMachine({ locale, milestones, labels }: { locale: string; milestones: Milestone[]; labels: Labels }) {
  const [open, setOpen] = useState(false);
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => { if (active) setHost(document.body); });
    return () => { active = false; };
  }, []);
  const [index, setIndex] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const [session] = useState(createTimeMachineSession);
  useEffect(() => {
    function launch() {
      if (session.active) return;
      const state = useExperienceStore.getState();
      const position = state.controller?.position?.() ?? { scene: state.scene, local: 0 };
      session.open({ ...position, scrollY: window.scrollY, opener: document.activeElement instanceof HTMLElement ? document.activeElement : null, playing: state.director === 'playing' });
      window.scrollTo({ top: window.scrollY, behavior: 'instant' });
      if (state.director === 'playing') useExperienceStore.setState({ director: 'paused' });
      window.dispatchEvent(new CustomEvent('nami:time-machine-interaction', { detail: true }));
      setOpen(true);
    }
    window.addEventListener('nami:time-machine', launch);
    return () => window.removeEventListener('nami:time-machine', launch);
  }, [session]);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    element?.showModal();
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
      window.dispatchEvent(new CustomEvent('nami:time-machine-interaction', { detail: false }));
      const position = session.close();
      if (position) {
        const state = useExperienceStore.getState();
        if (state.controller) state.controller.seek(position.scene, position.local, false);
        else window.scrollTo({ top: position.scrollY, behavior: 'instant' });
        position.opener?.focus({ preventScroll: true });
        if (position.playing && state.director === 'paused') useExperienceStore.setState({ director: 'playing' });
      }
    };
  }, [open, session]);
  function sliderKey(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    setIndex(current => timelineIndex(event.key, current, milestones.length, locale === 'ar'));
  }
  function pointer(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    setIndex(Math.round((locale === 'ar' ? 1 - fraction : fraction) * (milestones.length - 1)));
  }
  function trap(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === 'Escape') event.stopPropagation();
    if (event.key !== 'Tab') return;
    const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], [tabindex="0"]'));
    if (!elements.length) return;
    const first = elements[0], last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  const milestone = milestones[index];
  return host && createPortal(<dialog ref={dialog} className={styles.dialog} data-time-machine dir={locale === 'ar' ? 'rtl' : 'ltr'} aria-labelledby="time-machine-title" style={{ '--timeline-progress': `${index / Math.max(1, milestones.length - 1) * 100}%` } as CSSProperties} onKeyDown={trap} onCancel={event => { event.preventDefault(); event.stopPropagation(); setOpen(false); }}>
    <div className={styles.header}><h2 id="time-machine-title">{labels.title}</h2><button type="button" data-time-machine-close onClick={() => setOpen(false)} autoFocus>{labels.close}</button></div>
    <div className={styles.slider} role="slider" tabIndex={0} aria-label={labels.slider} aria-valuemin={1} aria-valuemax={milestones.length} aria-valuenow={index + 1} aria-valuetext={`${milestone.dateLabel}: ${milestone.label}`} onKeyDown={sliderKey} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); pointer(event); }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) pointer(event); }}>
      {milestones.map((item, i) => <span key={item.id} className={i === index ? styles.current : ''} aria-hidden="true" />)}
    </div>
    <article data-time-machine-milestone className={styles.milestone} aria-live="polite">{milestone.href && <p>{labels.published}</p>}<time dateTime={milestone.date}>{milestone.dateLabel}</time><h3>{milestone.label}</h3>{milestone.href && <a href={milestone.href}>{labels.article}</a>}</article>
    <div className={styles.navigation}><button type="button" data-time-machine-previous disabled={index === 0} onClick={() => setIndex(index - 1)}>{labels.previous}</button><span aria-hidden="true">{index + 1} / {milestones.length}</span><button type="button" data-time-machine-next disabled={index === milestones.length - 1} onClick={() => setIndex(index + 1)}>{labels.next}</button></div>
  </dialog>, host);
}
