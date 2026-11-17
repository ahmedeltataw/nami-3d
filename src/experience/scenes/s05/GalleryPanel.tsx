'use client';
import { projectSeekLocal } from './scene';

import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { useExperienceStore } from '../../store';
import type { GalleryProject } from './projects';
import styles from './panel.module.css';

export function GalleryPanel({ projects, locale }: { projects: GalleryProject[]; locale: string }) {
  const project = useExperienceStore(state => state.project);
  const renderer = useExperienceStore(state => state.profile.renderer);
  const motion = useExperienceStore(state => state.profile.motion);
  const ready = useExperienceStore(state => state.ui.ready);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const ar = locale === 'ar';
  const fallback = renderer === 'fallback';
  const selected = projects[project];
  function seek(index: number) {
    useExperienceStore.setState({ project: index });
    window.dispatchEvent(new CustomEvent('nami:project-seek', { detail: projectSeekLocal(index) }));
  }
  function orbit(yaw: number, pitch: number) { window.dispatchEvent(new CustomEvent('nami:gallery-orbit', { detail: { yaw, pitch } })); }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    orbit((event.clientX - drag.current.x) * .004, (event.clientY - drag.current.y) * .002);
    drag.current = { x: event.clientX, y: event.clientY };
  }
  function key(event: KeyboardEvent) {
    const arrows: Record<string, [number, number]> = { ArrowLeft: [-.08, 0], ArrowRight: [.08, 0], ArrowUp: [0, -.04], ArrowDown: [0, .04] };
    if (arrows[event.key]) { event.preventDefault(); orbit(...arrows[event.key]); }
  }
  const card = (item: GalleryProject) => <article key={item.slug} className={styles.card} data-project-card={item.slug}>
    <p className={styles.category}>{item.category ?? (ar ? 'التصنيف غير متاح' : 'Category unavailable')}</p>
    <h2>{item.name}</h2>
    <a href={`/${locale}/projects/${item.slug}`}>{ar ? 'عرض المشروع' : 'View Project'}</a>
  </article>;
  return <div className={`${styles.panel} ${fallback ? styles.fallback : ''}`} data-gallery-panel data-project={project}>
    <nav aria-label={ar ? 'المشاريع' : 'Projects'} className={styles.picker}>
      {projects.map((item, index) => <button type="button" key={item.slug} aria-pressed={project === index} onClick={() => seek(index)}>{item.name}</button>)}
    </nav>
    {fallback ? <div className={styles.list}>{projects.map(card)}</div> : <>
      {card(selected)}
      {!ready && <p role="status" className={styles.status}>{ar ? 'جاري تحميل المعرض' : 'Loading gallery'}</p>}
      {motion === 'full' && <div className={styles.explore} role="group" tabIndex={0} aria-label={ar ? 'اسحب لاستكشاف العالم أو استخدم مفاتيح الأسهم' : 'Drag to explore the world or use arrow keys'} onKeyDown={key}
        onPointerDown={event => { drag.current = { x: event.clientX, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={move} onPointerUp={event => { drag.current = null; event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}>
        <span>{ar ? 'اسحب للاستكشاف · مفاتيح الأسهم' : 'Drag to explore · Arrow keys'}</span>
      </div>}
    </>}
  </div>;
}
