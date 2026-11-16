import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getServices, getService, getProjects, textOr, type Locale } from '@/content';
import { buildMetadata, buildServiceJsonLd, buildBreadcrumbJsonLd, SITE_URL } from '@/lib/metadata';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import styles from '@/styles/page-stub.module.css';

export async function generateStaticParams() {
  const services = await getServices('ar');
  return services.map(service => ({ slug: service.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const service = await getService(slug, locale as Locale);
  if (!service) return { title: 'Not Found' };

  const title = textOr(service.title, slug);
  const description = textOr(service.description, title);

  return buildMetadata({
    locale: locale as Locale,
    path: `/services/${slug}`,
    title: `${title} | Nami Tech`,
    description,
  });
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  if (!hasLocale(routing.locales, rawLocale)) notFound();
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  const [service, allProjects, tNav, tContent] = await Promise.all([
    getService(slug, locale),
    getProjects(locale),
    getTranslations({ locale, namespace: 'Nav' }),
    getTranslations({ locale, namespace: 'ContentPages' }),
  ]);
  if (!service) notFound();

  const isAr = locale === 'ar';
  const title = textOr(service.title, slug);
  const description = textOr(service.description);

  // Check if any projects are mapped to this service in content
  const relatedProjects = allProjects.filter(project =>
    project.services.some(s => typeof s === 'string' && (s.toLowerCase().includes(slug) || s.includes(title)))
  );

  const breadcrumbs = [
    { label: tNav('home'), href: `/${locale}` },
    { label: tNav('services'), href: `/${locale}/services` },
    { label: title },
  ];

  const serviceUrl = `${SITE_URL}/${locale}/services/${slug}`;
  const serviceJsonLd = buildServiceJsonLd({
    name: title,
    description: description || title,
    url: serviceUrl,
    locale,
  });

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: tNav('home'), url: `${SITE_URL}/${locale}` },
    { name: tNav('services'), url: `${SITE_URL}/${locale}/services` },
    { name: title, url: serviceUrl },
  ]);

  // Secondary headings excluding main title
  const secondaryHeadings = service.headings.filter(
    h => typeof h.text === 'string' && h.text.trim() !== title.trim()
  );

  return (
    <main id="main" className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Breadcrumb items={breadcrumbs} ariaLabel={tContent('breadcrumbAria')} />

      <header className={styles.header}>
        <div className={styles.badge}>{isAr ? 'تفاصيل الخدمة' : 'Service Details'}</div>
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </header>

      {service.paragraphs.length > 0 && (
        <section className={styles.section} aria-label={tContent('overview')}>
          {service.paragraphs.map((p, index) =>
            typeof p === 'string' ? (
              <p key={index} className={styles.paragraph}>
                {p}
              </p>
            ) : null
          )}
        </section>
      )}

      {secondaryHeadings.length > 0 && (
        <section className={styles.section} aria-label={isAr ? 'أهداف الخدمة' : 'Objectives'}>
          {secondaryHeadings.map((h, hIdx) => (
            <h2 key={hIdx} className={styles.subheading}>
              {h.text as string}
            </h2>
          ))}
        </section>
      )}

      {service.lists.length > 0 && (
        <section className={styles.section} aria-label={isAr ? 'مزايا الخدمة' : 'Features'}>
          {service.lists.map((list, listIdx) => (
            <ul key={listIdx} className={styles.list}>
              {list.items.map((item, itemIdx) =>
                typeof item === 'string' ? (
                  <li key={itemIdx} className={styles.listItem}>
                    {item}
                  </li>
                ) : null
              )}
            </ul>
          ))}
        </section>
      )}

      {relatedProjects.length > 0 && (
        <section className={styles.section} aria-label={tContent('relatedProjects')}>
          <h2 className={styles.sectionTitle}>{tContent('relatedProjects')}</h2>
          <div className={styles.grid}>
            {relatedProjects.map(project => {
              const projTitle = textOr(project.title, project.slug);
              return (
                <article key={project.slug} className={styles.card}>
                  <h3 className={styles.cardTitle}>{projTitle}</h3>
                  <p className={styles.cardDesc}>{textOr(project.description)}</p>
                  <Link href={`/${locale}/projects/${project.slug}`} className={styles.cardLink}>
                    {isAr ? 'عرض دراسة الحالة ←' : 'View case study →'}
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section className={styles.ctaSection} aria-label={tContent('ctaContactTitle')}>
        <h2 className={styles.ctaTitle}>{tContent('ctaContactTitle')}</h2>
        <p className={styles.ctaDesc}>{tContent('ctaContactText')}</p>
        <Link href={`/${locale}/contact`} className={styles.ctaButton}>
          {tContent('ctaContactButton')}
        </Link>
      </section>

      <footer className={styles.header}>
        <Link href={`/${locale}/services`} className={styles.backLink}>
          {tContent('backToServices')}
        </Link>
      </footer>
    </main>
  );
}
