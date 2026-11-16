'use client';

import { useExperienceStore } from '../../store';
import styles from './panel.module.css';

type Service = { id: number; title: string; description: string; href: string };
export function StationPanel({ services, locale }: { services: Service[]; locale: string }) {
  const station = useExperienceStore(state => state.station);
  const selected = services.find(service => service.id === station) ?? services[0];
  function seek(id: number) {
    const local = .1 + .9 * (id - 1 + .8) / 6;
    useExperienceStore.setState({ station: id });
    window.dispatchEvent(new CustomEvent('nami:station-seek', { detail: local }));
  }
  return <div className={styles.panel}>
    <nav aria-label={locale === 'ar' ? 'الخدمات' : 'Services'} className={styles.picker}>
      {services.map(service => <button key={service.id} type="button" aria-pressed={station === service.id} onClick={() => seek(service.id)}>{service.title}</button>)}
    </nav>
    {selected && <div className={styles.card}><h2>{selected.title}</h2><p>{selected.description}</p><a href={selected.href}>{locale === 'ar' ? 'تفاصيل الخدمة' : 'Service details'}</a></div>}
  </div>;
}
