import { getLocale, getTranslations } from 'next-intl/server';
import { getServices, type Locale } from '@/content';
import { StationPanel } from '@/experience/scenes/s03/StationPanel';
import { stations } from '@/experience/scenes/s03/station';
import styles from './page.module.css';
import { SCENE_IDS, SCROLL_BUDGETS } from '@/experience/controller';
import type { CSSProperties } from 'react';

export default async function Home() {
  const t = await getTranslations('Home');
  const locale = await getLocale() as Locale;
  const services = await getServices(locale);
  const fields = new Map<string, string>();
  for (const service of services) {
    if (typeof service.title === 'string') fields.set(`${service.slug}.title`, service.title);
    if (typeof service.description === 'string') fields.set(`${service.slug}.description`, service.description);
  }
  const panels = stations.map(station => {
    const service = services.find(item => item.slug === station.slug);
    if (!service) throw new Error(`Missing service content: ${station.slug}`);
    return { id: station.id, title: fields.get(station.panel.titleKey) ?? '', description: fields.get(station.panel.descKey) ?? '', href: new URL(`/${locale}${station.panel.href}`, service.sourceUrl).href };
  });
  return <main id="main" className={styles.main}>
    <nav className={styles.nav} aria-label="Scenes">{SCENE_IDS.map(id => <a key={id} href={`#${id}`}>{id}</a>)}</nav>
    {SCENE_IDS.map((id, index) => <section key={id} id={id} className={styles.section} style={{ '--budget': SCROLL_BUDGETS[index] } as CSSProperties}>
      {id === 's03' ? <StationPanel services={panels} locale={locale} /> : <div className={`${styles.content} ${index === 0 ? styles.hero : ''}`}>{index === 0 ? <>
          <h1 data-s01-headline>{t('heading')}</h1>
          <p className={styles.subtitle}>{t('subtitle')}</p>
          <div className={styles.actions}>
            <a href="#s05">{t('projects')}</a><a href="#s07">{t('contact')}</a>
          </div>
          <p className={styles.scrollHint}>{t('scrollHint')}</p>
          <button className={styles.skipIntro} type="button" data-s01-skip aria-label={t('skipIntro')}>{t('skipIntro')}</button>
        </> : <><h2>{id}</h2><p>{id} · Placeholder</p></>}</div>}
    </section>)}
  </main>;
}
