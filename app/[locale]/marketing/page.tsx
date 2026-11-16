import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getPage, type Locale } from '@/content';
import { buildMetadata } from '@/lib/metadata';
import styles from '@/styles/page-stub.module.css';

const MARKETING_PAGE_SLUG = 'digital-marketing';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isAr = locale === 'ar';
  const page = await getPage(MARKETING_PAGE_SLUG, locale as Locale);
  return buildMetadata({
    locale: locale as Locale,
    path: '/marketing',
    title: isAr ? 'التسويق الرقمي | نامي تيك' : 'Digital Marketing | Nami Tech',
    description: typeof page?.description === 'string'
      ? page.description
      : (isAr ? 'خدمات التسويق الرقمي وإدارة الحملات الإعلانية وتحسين محركات البحث.' : 'Digital marketing services, advertising campaign management, and search engine optimization.'),
  });
}

export default async function MarketingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!hasLocale(routing.locales, rawLocale)) notFound();
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  const page = await getPage(MARKETING_PAGE_SLUG, locale);
  const isAr = locale === 'ar';
  const title = typeof page?.headings?.[0]?.text === 'string'
    ? page.headings[0].text
    : (isAr ? 'التسويق الرقمي' : 'Digital Marketing');

  return (
    <main id="main" className={styles.page}>
      <header className={styles.header}>
        <div className={styles.badge}>{isAr ? 'خدمات تسويقية' : 'Marketing'}</div>
        <h1 className={styles.title}>{title}</h1>
        {typeof page?.description === 'string' && (
          <p className={styles.description}>{page.description}</p>
        )}
      </header>

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

      {page && page.lists.map((list, listIdx) => (
        <section key={listIdx} className={styles.section}>
          <ul className={styles.list}>
            {list.items.map((item, itemIdx) =>
              typeof item === 'string' ? (
                <li key={itemIdx} className={styles.listItem}>
                  {item}
                </li>
              ) : null
            )}
          </ul>
        </section>
      ))}
    </main>
  );
}
