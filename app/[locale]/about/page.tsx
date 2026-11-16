import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getCompany, getPage, type Locale } from '@/content';
import { buildMetadata } from '@/lib/metadata';
import styles from '@/styles/page-stub.module.css';

const ABOUT_PAGE_SLUG = 'nami-is-a-company-specialized-in-providing-integrated-web-services';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isAr = locale === 'ar';
  const page = await getPage(ABOUT_PAGE_SLUG, locale as Locale);
  return buildMetadata({
    locale: locale as Locale,
    path: '/about',
    title: isAr ? 'من نحن | نامي تيك' : 'About Us | Nami Tech',
    description: typeof page?.description === 'string'
      ? page.description
      : (isAr ? 'تعرف على قصة نامي تيك، رؤيتنا، رسالتنا، وقيمنا الجوهرية.' : 'Learn about Nami Tech, our story, mission, vision, and core values.'),
  });
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!hasLocale(routing.locales, rawLocale)) notFound();
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  const [company, page] = await Promise.all([
    getCompany(locale),
    getPage(ABOUT_PAGE_SLUG, locale),
  ]);

  const isAr = locale === 'ar';
  const title = typeof page?.headings?.[0]?.text === 'string'
    ? page.headings[0].text
    : (isAr ? 'من نحن' : 'About Us');

  return (
    <main id="main" className={styles.page}>
      <header className={styles.header}>
        <div className={styles.badge}>{isAr ? 'من نحن' : 'About Us'}</div>
        <h1 className={styles.title}>{title}</h1>
        {typeof page?.description === 'string' && (
          <p className={styles.description}>{page.description}</p>
        )}
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{isAr ? 'رؤيتنا' : 'Our Vision'}</h2>
        <p className={styles.paragraph}>{company.vision[locale] as string}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{isAr ? 'رسالتنا' : 'Our Mission'}</h2>
        <p className={styles.paragraph}>{company.mission[locale] as string}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{isAr ? 'قيمنا الجوهرية' : 'Core Values'}</h2>
        <div className={styles.grid}>
          {company.values.map(val => (
            <div key={val.id} className={styles.card}>
              <h3 className={styles.cardTitle}>{val.name[locale] as string}</h3>
              {typeof val.description[locale] === 'string' && (
                <p className={styles.cardDesc}>{val.description[locale] as string}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {page && page.paragraphs.length > 0 && (
        <section className={styles.section}>
          {page.paragraphs.map((p, index) =>
            typeof p === 'string' ? (
              <p key={index} className={styles.paragraph}>
                {p}
              </p>
            ) : null
          )}
        </section>
      )}
    </main>
  );
}
