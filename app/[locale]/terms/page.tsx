import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getLegal, textOr, type Locale } from '@/content';
import { buildMetadata } from '@/lib/metadata';
import styles from '@/styles/page-stub.module.css';

const TERMS_SLUG = 'terms-and-conditions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const legal = await getLegal(TERMS_SLUG, locale as Locale);
  if (!legal) return { title: 'Not Found' };
  const title = textOr(legal.title, 'Terms and Conditions');
  const description = textOr(legal.description, title);

  return buildMetadata({
    locale: locale as Locale,
    path: '/terms',
    title: `${title} | Nami Tech`,
    description,
  });
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!hasLocale(routing.locales, rawLocale)) notFound();
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  const legal = await getLegal(TERMS_SLUG, locale);
  if (!legal) notFound();

  const isAr = locale === 'ar';

  const title = textOr(legal.title, 'Terms and Conditions');
  const description = textOr(legal.description);

  return (
    <main id="main" className={styles.page}>
      <header className={styles.header}>
        <div className={styles.badge}>{isAr ? 'وثيقة قانونية' : 'Legal'}</div>
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </header>

      {legal.paragraphs.length > 0 && (
        <section className={styles.section}>
          {legal.paragraphs.map((p, index) =>
            typeof p === 'string' ? (
              <p key={index} className={styles.paragraph}>
                {p}
              </p>
            ) : null
          )}
        </section>
      )}

      {legal.lists.map((list, listIdx) => (
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
