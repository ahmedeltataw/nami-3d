import { getTranslations } from 'next-intl/server';
import styles from './page.module.css';
import { SCENE_IDS, SCROLL_BUDGETS } from '@/experience/controller';
import type { CSSProperties } from 'react';

export default async function Home() {
  const t = await getTranslations('Home');
  return <main id="main" className={styles.main}>
    <nav className={styles.nav} aria-label="Scenes">{SCENE_IDS.map(id => <a key={id} href={`#${id}`}>{id}</a>)}</nav>
    {SCENE_IDS.map((id, index) => <section key={id} id={id} className={styles.section} style={{ '--budget': SCROLL_BUDGETS[index] } as CSSProperties}>
      <div className={`${styles.content} ${index === 0 ? styles.hero : ''}`}>{index === 0 ? <>
        <h1 data-s01-headline>{t('heading')}</h1>
        <p className={styles.subtitle}>{t('subtitle')}</p>
        <div className={styles.actions}>
          <a href="#s05">{t('projects')}</a><a href="#s07">{t('contact')}</a>
        </div>
        <p className={styles.scrollHint}>{t('scrollHint')}</p>
        <button className={styles.skipIntro} type="button" data-s01-skip aria-label={t('skipIntro')}>{t('skipIntro')}</button>
      </> : <><h2>{id}</h2><p>{id} · Placeholder</p></>}</div>
    </section>)}
  </main>;
}
