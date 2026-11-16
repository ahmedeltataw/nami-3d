import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getServices, textOr, type Locale } from '@/content';
import { buildMetadata, buildBreadcrumbJsonLd, SITE_URL } from '@/lib/metadata';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import styles from '@/styles/page-stub.module.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isAr = locale === 'ar';
  return buildMetadata({
    locale: locale as Locale,
    path: '/services',
    title: isAr ? 'خدماتنا البرمجية والرقمية | نامي تيك' : 'Our Services & Digital Solutions | Nami Tech',
    description: isAr
      ? 'اكتشف خدمات نامي المتكاملة في تصميم وتطوير المواقع وتطبيقات الجوال والتسويق الرقمي والحلول السحابية.'
      : 'Explore Nami integrated services in custom web development, mobile apps, digital marketing, and cloud solutions.',
  });
}

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!hasLocale(routing.locales, rawLocale)) notFound();
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  const [services, t, tContent] = await Promise.all([
    getServices(locale),
    getTranslations({ locale, namespace: 'Nav' }),
    getTranslations({ locale, namespace: 'ContentPages' }),
  ]);
  const isAr = locale === 'ar';

  const breadcrumbs = [
    { label: t('home'), href: `/${locale}` },
    { label: t('services') },
  ];

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: t('home'), url: `${SITE_URL}/${locale}` },
    { name: t('services'), url: `${SITE_URL}/${locale}/services` },
  ]);

  return (
    <main id="main" className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Breadcrumb items={breadcrumbs} ariaLabel={tContent('breadcrumbAria')} />

      <header className={styles.header}>
        <div className={styles.badge}>{isAr ? 'حلول متكاملة' : 'Full-Spectrum Solutions'}</div>
        <h1 className={styles.title} data-reveal>{t('services')}</h1>
        <p className={styles.description}>
          {isAr
            ? 'نقدم مجموعة متكاملة من الحلول الرقمية لتلبية احتياجات أعمالكم وتحقيق نمو مستدام من خلال منتجات برمجية موثوقة.'
            : 'We offer an integrated suite of digital solutions to empower your business growth through high-performance software products.'}
        </p>
      </header>

      <section aria-label={t('services')} className={styles.section}>
        <div className={styles.grid}>
          {services.map(service => {
            const serviceTitle = textOr(service.title, service.slug);
            const serviceDesc = textOr(service.description);
            return (
              <article key={service.slug} className={styles.card} data-reveal>
                <span className={styles.badge}>
                  {isAr ? 'خدمة متخصصة' : 'Service'}
                </span>
                <h2 className={styles.cardTitle}>{serviceTitle}</h2>
                <p className={styles.cardDesc}>{serviceDesc}</p>
                <Link href={`/${locale}/services/${service.slug}`} className={styles.cardLink}>
                  {isAr ? 'عرض تفاصيل الخدمة ←' : 'View service details →'}
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.ctaSection} aria-label={tContent('ctaContactTitle')}>
        <h2 className={styles.ctaTitle} data-reveal>{tContent('ctaContactTitle')}</h2>
        <p className={styles.ctaDesc}>{tContent('ctaContactText')}</p>
        <Link href={`/${locale}/contact`} className={styles.ctaButton}>
          {tContent('ctaContactButton')}
        </Link>
      </section>
    </main>
  );
}
