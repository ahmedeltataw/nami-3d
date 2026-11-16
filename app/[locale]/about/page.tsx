import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getCompany, getPage, isText, type Locale } from '@/content';
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
    description:
      typeof page?.description === 'string'
        ? page.description
        : isAr
          ? 'تعرف على قصة نامي تيك، رؤيتنا، رسالتنا، وقيمنا الجوهرية.'
          : 'Learn about Nami Tech, our story, mission, vision, and core values.',
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
  const title =
    typeof page?.headings?.[0]?.text === 'string'
      ? page.headings[0].text
      : isAr
        ? 'من نحن'
        : 'About Us';

  const vision = isText(company.vision[locale]) ? company.vision[locale] : null;
  const mission = isText(company.mission[locale]) ? company.mission[locale] : null;

  return (
    <main id="main" className={styles.page}>
      <header className={styles.header}>
        <div className={styles.badge}>
          {isAr ? `تأسست عام ${company.foundedYear}` : `Founded ${company.foundedYear}`}
        </div>
        <h1 className={styles.title} data-reveal>{title}</h1>
        {typeof page?.description === 'string' && (
          <p className={styles.description}>{page.description}</p>
        )}
      </header>

      {vision && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle} data-reveal>{isAr ? 'رؤيتنا' : 'Our Vision'}</h2>
          <p className={styles.paragraph}>{vision}</p>
        </section>
      )}

      {mission && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle} data-reveal>{isAr ? 'رسالتنا' : 'Our Mission'}</h2>
          <p className={styles.paragraph}>{mission}</p>
        </section>
      )}

      {/* Core Values: values with missing descriptions are rendered name-only */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle} data-reveal>{isAr ? 'قيمنا الجوهرية' : 'Core Values'}</h2>
        <div className={styles.grid}>
          {company.values.map(val => {
            const name = isText(val.name[locale]) ? val.name[locale] : val.id;
            const desc = isText(val.description[locale]) ? val.description[locale] : null;
            return (
              <div key={val.id} className={styles.card} data-reveal>
                <h3 className={styles.cardTitle}>{name}</h3>
                {desc && <p className={styles.cardDesc}>{desc}</p>}
              </div>
            );
          })}
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
