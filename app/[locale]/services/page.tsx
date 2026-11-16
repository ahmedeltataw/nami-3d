import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getServices, textOr, type Locale } from '@/content';
import { buildMetadata } from '@/lib/metadata';
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
    title: isAr ? 'خدماتنا | نامي تيك' : 'Our Services | Nami Tech',
    description: isAr
      ? 'اكتشف خدمات نامي المتكاملة في تصميم وتطوير المواقع وتطبيقات الجوال والتسويق الرقمي.'
      : 'Explore Nami integrated services in website development, mobile apps, and digital marketing.',
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

  const services = await getServices(locale);
  const isAr = locale === 'ar';

  return (
    <main id="main" className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{isAr ? 'خدماتنا' : 'Our Services'}</h1>
        <p className={styles.description}>
          {isAr
            ? 'نقدم مجموعة متكاملة من الحلول الرقمية لتلبية احتياجات أعمالكم وتحقيق نمو مستدام.'
            : 'We offer an integrated suite of digital solutions to grow your business and drive sustainable digital success.'}
        </p>
      </header>

      <div className={styles.grid}>
        {services.map(service => {
          const serviceTitle = textOr(service.title);
          const serviceDesc = textOr(service.description);
          return (
            <article key={service.slug} className={styles.card}>
              <h2 className={styles.cardTitle}>{serviceTitle}</h2>
              <p className={styles.cardDesc}>{serviceDesc}</p>
              <Link href={`/${locale}/services/${service.slug}`} className={styles.cardLink}>
                {isAr ? 'عرض تفاصيل الخدمة ←' : 'View service details →'}
              </Link>
            </article>
          );
        })}
      </div>
    </main>
  );
}
