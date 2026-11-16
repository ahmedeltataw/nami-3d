import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getPage, type Locale } from '@/content';
import { buildMetadata, buildBreadcrumbJsonLd, buildServiceJsonLd, SITE_URL } from '@/lib/metadata';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
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
    title: isAr ? 'حلول واستراتيجيات التسويق الرقمي | نامي تيك' : 'Digital Marketing & Growth Solutions | Nami Tech',
    description: typeof page?.description === 'string'
      ? page.description
      : (isAr
        ? 'خدمات التسويق الرقمي المتكاملة، إدارة الحملات الإعلانية، تصميم المحتوى، وزيادة المبيعات عبر الإنترنت.'
        : 'Comprehensive digital marketing strategies, advertising campaign management, creative content design, and online growth.'),
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

  const [page, tNav, tContent] = await Promise.all([
    getPage(MARKETING_PAGE_SLUG, locale),
    getTranslations({ locale, namespace: 'Nav' }),
    getTranslations({ locale, namespace: 'ContentPages' }),
  ]);
  const isAr = locale === 'ar';

  const h1Item = page?.headings?.find(h => h.level === 'h1')?.text;
  const title = typeof h1Item === 'string' ? h1Item : (isAr ? 'التسويق الرقمي' : 'Digital Marketing');
  const h6Item = page?.headings?.find(h => h.level === 'h6')?.text;
  const subtitle = typeof h6Item === 'string'
    ? h6Item
    : (typeof page?.description === 'string' ? page.description : '');

  // Sub-campaign headings and matching paragraphs
  const campaignHeadings = page?.headings?.filter(h => h.level === 'h4' && typeof h.text === 'string') || [];
  const campaignParagraphs = page?.paragraphs?.filter((p): p is string => typeof p === 'string') || [];

  const breadcrumbs = [
    { label: tNav('home'), href: `/${locale}` },
    { label: title },
  ];

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: tNav('home'), url: `${SITE_URL}/${locale}` },
    { name: title, url: `${SITE_URL}/${locale}/marketing` },
  ]);

  const serviceJsonLd = buildServiceJsonLd({
    name: title,
    description: subtitle || title,
    url: `${SITE_URL}/${locale}/marketing`,
    locale,
  });

  return (
    <main id="main" className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <Breadcrumb items={breadcrumbs} ariaLabel={tContent('breadcrumbAria')} />

      <header className={styles.header}>
        <div className={styles.badge}>{isAr ? 'حملات وشراكات ناجحة' : 'Impactful Campaigns'}</div>
        <h1 className={styles.title}>{title}</h1>
        {subtitle && <p className={styles.description}>{subtitle}</p>}
      </header>

      {campaignHeadings.length > 0 ? (
        <section aria-label={isAr ? 'أعمال وحملات التسويق' : 'Marketing campaigns'} className={styles.section}>
          <div className={styles.grid}>
            {campaignHeadings.map((heading, idx) => {
              const paragraph = campaignParagraphs[idx] || '';
              return (
                <article key={idx} className={styles.card}>
                  <span className={styles.badge}>{isAr ? 'قصة نجاح' : 'Case Study'}</span>
                  <h2 className={styles.cardTitle}>{heading.text as string}</h2>
                  {paragraph && <p className={styles.cardDesc}>{paragraph}</p>}
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        page && page.paragraphs.length > 0 && (
          <section className={styles.section}>
            {page.paragraphs.map((p, idx) =>
              typeof p === 'string' ? (
                <p key={idx} className={styles.paragraph}>
                  {p}
                </p>
              ) : null
            )}
          </section>
        )
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

      <section className={styles.ctaSection} aria-label={tContent('ctaContactTitle')}>
        <h2 className={styles.ctaTitle}>{tContent('ctaContactTitle')}</h2>
        <p className={styles.ctaDesc}>{tContent('ctaContactText')}</p>
        <Link href={`/${locale}/contact`} className={styles.ctaButton}>
          {tContent('ctaContactButton')}
        </Link>
      </section>
    </main>
  );
}
