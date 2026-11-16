import { getTranslations } from 'next-intl/server';
import styles from './page.module.css';
import { SCENE_IDS, SCROLL_BUDGETS } from '@/experience/controller';
import type { CSSProperties } from 'react';

export default async function Home() {
  const t = await getTranslations('Home');
  return <main id="main" className={styles.main}>
    <nav className={styles.nav} aria-label="Scenes">{SCENE_IDS.map(id => <a key={id} href={`#${id}`}>{id}</a>)}</nav>
    {SCENE_IDS.map((id, index) => <section key={id} id={id} className={styles.section} style={{ '--budget': SCROLL_BUDGETS[index] } as CSSProperties}>
      <div className={styles.content}>{index === 0 ? <h1>{t('heading')}</h1> : <h2>{id}</h2>}<p>{id} · Placeholder</p></div>
    </section>)}
  </main>;
}
