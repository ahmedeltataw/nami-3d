import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getServices, getService, textOr, type Locale } from '@/content';
import { buildMetadata } from '@/lib/metadata';
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

  const service = await getService(slug, locale);
  if (!service) notFound();

  const isAr = locale === 'ar';

  const title = textOr(service.title, slug);
  const description = textOr(service.description);

  return (
    <main id="main" className={styles.page}>
      <header className={styles.header}>
        <div className={styles.badge}>{isAr ? 'خدمة' : 'Service'}</div>
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </header>

      {service.paragraphs.length > 0 && (
        <section className={styles.section}>
          {service.paragraphs.map((p, index) =>
            typeof p === 'string' ? (
              <p key={index} className={styles.paragraph}>
                {p}
              </p>
            ) : null
          )}
        </section>
      )}

      {service.lists.map((list, listIdx) => (
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

      <footer className={styles.header}>
        <Link href={`/${locale}/services`} className={styles.cardLink}>
          {isAr ? '← العودة لجميع الخدمات' : '← Back to all services'}
        </Link>
      </footer>
    </main>
  );
}
