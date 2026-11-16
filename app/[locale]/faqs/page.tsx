import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getFaqs, textOr, type Locale } from '@/content';
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
  const faqs = await getFaqs(locale as Locale);
  const first = faqs[0];
  return buildMetadata({
    locale: locale as Locale,
    path: '/faqs',
    title: isAr ? 'الأسئلة الشائعة | نامي تيك' : 'Frequently Asked Questions | Nami Tech',
    description: typeof first?.description === 'string'
      ? first.description
      : (isAr ? 'إجابات على أكثر الأسئلة شيوعاً حول خدمات نامي تيك ومراحل العمل والأسعار.' : 'Answers to frequently asked questions about Nami Tech services, workflows, and pricing.'),
  });
}

export default async function FaqsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!hasLocale(routing.locales, rawLocale)) notFound();
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  const faqs = await getFaqs(locale);
  const isAr = locale === 'ar';
  const first = faqs[0];
  const title = typeof first?.title === 'string' ? first.title : (isAr ? 'الأسئلة الشائعة' : 'Frequently Asked Questions');

  return (
    <main id="main" className={styles.page}>
      <header className={styles.header}>
        <div className={styles.badge}>{isAr ? 'إجابات سريعة' : 'FAQ'}</div>
        <h1 className={styles.title}>{title}</h1>
        {typeof first?.description === 'string' && (
          <p className={styles.description}>{first.description}</p>
        )}
      </header>

      {first && (
        <div className={styles.grid}>
          {first.headings.map((h, idx) => (
            <div key={idx} className={styles.card}>
              <h2 className={styles.cardTitle}>{textOr(h.text)}</h2>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
