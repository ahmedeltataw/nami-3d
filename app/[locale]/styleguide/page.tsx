import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { contrast, parseColors, TEXT_PAIRS, type Theme } from '@/lib/contrast';
import styles from './styleguide.module.css';

export const metadata: Metadata = { title: 'Styleguide', robots: { index: false, follow: false } };

const css = readFileSync(join(process.cwd(), 'src/styles/tokens.css'), 'utf8');
const sample: Record<string, { ar: string; en: string }> = {
  h1: { ar: 'نامي للحلول الرقمية', en: 'Nami digital solutions' },
  h2: { ar: 'نبني تجارب ثلاثية الأبعاد', en: 'We build 3D experiences' },
  h3: { ar: 'عنوان فرعي', en: 'Section heading' },
  h4: { ar: 'عنوان رابع', en: 'Fourth heading' },
  h5: { ar: 'عنوان خامس', en: 'Fifth heading' },
  h6: { ar: 'عنوان سادس', en: 'Sixth heading' },
};
const body = {
  ar: 'نص أساسي يوضح ارتفاع السطر وتشكيل الحروف العربية في الفقرات الطويلة.',
  en: 'Body copy showing line height and rhythm across long paragraphs of text.',
};

function Palette({ theme }: { theme: Theme }) {
  const colors = parseColors(css, theme);
  return (
    <section data-theme={theme} dir="ltr" lang="en" className={styles.panel} aria-label={`${theme} palette`}>
      <h2>{theme}</h2>
      <ul className={styles.swatches}>
        {Object.entries(colors).map(([name, hex]) => (
          <li key={name}>
            <span className={styles.chip} style={{ background: hex }} />
            <code>{name}</code> <code>{hex}</code>
          </li>
        ))}
      </ul>
      <table className={styles.table}>
        <thead>
          <tr><th>Pair</th><th>Ratio</th><th>Min</th><th>AA</th></tr>
        </thead>
        <tbody>
          {TEXT_PAIRS.map(({ fg, bg, min }) => {
            const r = contrast(colors[fg], colors[bg]);
            return (
              <tr key={fg + bg}>
                <td>{fg} / {bg}</td>
                <td>{r.toFixed(2)}:1</td>
                <td>{min}</td>
                <td>{r >= min ? 'pass' : 'fail'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

export default async function Styleguide({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main id="main" className={styles.page}>
      <h1>Styleguide</h1>
      <Palette theme="light" />
      <Palette theme="dark" />
      <section aria-label="typography">
        <h2>Type scale</h2>
        {(['ar', 'en'] as const).map((l) => (
          <div key={l} lang={l} dir={l === 'ar' ? 'rtl' : 'ltr'} className={styles.type}>
            {Object.entries(sample).map(([tag, text]) => {
              const Tag = tag as 'h1';
              return <Tag key={tag}>{text[l]}</Tag>;
            })}
            <p>{body[l]}</p>
            <small>{l === 'ar' ? 'تسمية توضيحية' : 'Caption text'}</small>
          </div>
        ))}
      </section>
      <section aria-label="controls">
        <h2>Buttons and links</h2>
        <div className={styles.row}>
          <button type="button" className={styles.primary}>Primary</button>
          <button type="button" className={styles.secondary}>Secondary</button>
          <a href="#main">Link</a>
        </div>
      </section>
    </main>
  );
}
