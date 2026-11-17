'use client';

import { useExperienceStore } from '../../store';
import styles from './panel.module.css';
import { stationSeekLocal } from './scene';

type Service = { id: number; title: string; description: string; href: string };
export function StationPanel({ services, locale }: { services: Service[]; locale: string }) {
  const station = useExperienceStore(state => state.station);
  const active = useExperienceStore(state => state.scene === 's03' && state.profile.motion === 'full' && state.profile.renderer === 'webgl');
  const selected = services.find(service => service.id === station) ?? services[0];
  function seek(id: number) {
    useExperienceStore.setState({ station: id });
    const local = stationSeekLocal(id);
    window.dispatchEvent(new CustomEvent('nami:station-seek', { detail: local }));
  }
  return <div className={styles.panel} data-active={active}>
    <nav aria-label={locale === 'ar' ? 'تقدم المحطات' : 'Station progress'} className={styles.dots} data-station-dots>
      {services.map(service => <button key={service.id} type="button" aria-label={service.title} aria-current={station === service.id ? 'step' : undefined} onClick={() => seek(service.id)}><span /></button>)}
    </nav>
    <nav aria-label={locale === 'ar' ? 'الخدمات' : 'Services'} className={styles.picker}>
      {services.map(service => <button key={service.id} type="button" aria-pressed={station === service.id} onClick={() => seek(service.id)}>{service.title}</button>)}
    </nav>
    {selected && <div className={styles.card}><h2>{selected.title}</h2><p>{selected.description}</p><a href={selected.href}>{locale === 'ar' ? 'تفاصيل الخدمة' : 'Service details'}</a></div>}
  </div>;
}
