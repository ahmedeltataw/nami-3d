import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getLegal, textOr, type Locale } from '@/content';
import { buildMetadata, buildBreadcrumbJsonLd, SITE_URL } from '@/lib/metadata';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
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
  const title = textOr(legal.title, 'Terms & Conditions');
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

  const [legal, tNav, tContent] = await Promise.all([
    getLegal(TERMS_SLUG, locale),
    getTranslations({ locale, namespace: 'Nav' }),
    getTranslations({ locale, namespace: 'ContentPages' }),
  ]);
  if (!legal) notFound();

  const isAr = locale === 'ar';
  const title = textOr(legal.title, isAr ? 'الشروط والأحكام' : 'Terms & Conditions');
  const description = textOr(legal.description);

  // Filter sections that start with a number (1., 2., etc.)
  const sectionHeadings = legal.headings.filter(
    h => typeof h.text === 'string' && /^\d+\./.test(h.text.trim())
  );

  const paragraphs = legal.paragraphs.filter((p): p is string => typeof p === 'string');
  const introParagraph = paragraphs[0];
  const bodyParagraphs = paragraphs.slice(1);

  // Group paragraphs under sections
  const paragraphsPerSection = sectionHeadings.length > 0
    ? Math.max(1, Math.floor(bodyParagraphs.length / sectionHeadings.length))
    : bodyParagraphs.length;

  const breadcrumbs = [
    { label: tNav('home'), href: `/${locale}` },
    { label: title },
  ];

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: tNav('home'), url: `${SITE_URL}/${locale}` },
    { name: title, url: `${SITE_URL}/${locale}/terms` },
  ]);

  return (
    <main id="main" className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Breadcrumb items={breadcrumbs} ariaLabel={tContent('breadcrumbAria')} />

      <header className={styles.header}>
        <div className={styles.badge}>{isAr ? 'اتفاقية الاستخدام والشروط' : 'Terms of Service'}</div>
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </header>

      {/* Table of Contents */}
      {sectionHeadings.length > 0 && (
        <nav aria-label={tContent('tableOfContents')} className={styles.tocCard}>
          <h2 className={styles.tocTitle}>{tContent('tableOfContents')}</h2>
          <ol className={styles.tocList}>
            {sectionHeadings.map((h, idx) => (
              <li key={idx}>
                <a href={`#section-${idx + 1}`} className={styles.tocLink}>
                  {h.text as string}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* Intro section */}
      {introParagraph && (
        <section className={styles.section} aria-label={tContent('overview')}>
          <p className={styles.paragraph}>{introParagraph}</p>
        </section>
      )}

      {/* Numbered Sections */}
      {sectionHeadings.length > 0 ? (
        sectionHeadings.map((heading, sIdx) => {
          const start = sIdx * paragraphsPerSection;
          const end = sIdx === sectionHeadings.length - 1 ? bodyParagraphs.length : start + paragraphsPerSection;
          const sectionPs = bodyParagraphs.slice(start, end);

          return (
            <section key={sIdx} className={styles.section} aria-labelledby={`section-${sIdx + 1}`}>
              <h2 id={`section-${sIdx + 1}`} className={styles.sectionTitle}>
                {heading.text as string}
              </h2>
              {sectionPs.map((p, pIdx) => (
                <p key={pIdx} className={styles.paragraph}>
                  {p}
                </p>
              ))}
            </section>
          );
        })
      ) : (
        <section className={styles.section}>
          {bodyParagraphs.map((p, pIdx) => (
            <p key={pIdx} className={styles.paragraph}>
              {p}
            </p>
          ))}
        </section>
      )}

      {/* Lists if present */}
      {legal.lists.map((list, listIdx) => (
        <section key={listIdx} className={styles.section} aria-label={isAr ? 'بنود الشروط' : 'Clauses'}>
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
