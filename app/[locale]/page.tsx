import { getTranslations } from 'next-intl/server';
import styles from './page.module.css';

export default async function Home() {
  const t = await getTranslations('Home');
  return <main className={styles.main}><h1>{t('heading')}</h1></main>;
}
