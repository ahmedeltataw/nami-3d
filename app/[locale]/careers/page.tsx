import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getCompany, type Locale } from '@/content';
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
    path: '/careers',
    title: isAr ? 'الوظائف الشاغرة | نامي تيك' : 'Careers | Nami Tech',
    description: isAr
      ? 'انضم إلى فريق عمل نامي المبدع واستكشف أحدث الفرص الوظيفية في تطوير البرمجيات.'
      : 'Join our talented team at Nami and explore available career opportunities in software development.',
  });
}

export default async function CareersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!hasLocale(routing.locales, rawLocale)) notFound();
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  const company = await getCompany(locale);
  const isAr = locale === 'ar';

  return (
    <main id="main" className={styles.page}>
      <header className={styles.header}>
        <div className={styles.badge}>{isAr ? 'انضم إلينا' : 'Join Us'}</div>
        <h1 className={styles.title}>{isAr ? 'الوظائف الشاغرة' : 'Careers'}</h1>
        <p className={styles.description}>
          {isAr
            ? 'نسعى دائماً لاستقطاب الكفاءات المتميزة والمبدعة للانضمام إلى فريق عملنا والمساهمة في بناء حلول رقمية مبتكرة.'
            : 'We are always looking for passionate and talented individuals to join our growing engineering team.'}
        </p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{isAr ? 'الوظائف المتاحة حالياً' : 'Open Positions'}</h2>
        <div className={styles.grid}>
          {company.careers.listing.map((job, idx) => {
            const title = isAr
              ? (typeof job.title === 'string' ? job.title : 'مطور برمجيات')
              : (typeof job.titleEn === 'string' ? job.titleEn : 'Software Developer');
            return (
              <div key={idx} className={styles.card}>
                <h3 className={styles.cardTitle}>{title}</h3>
                <p className={styles.cardDesc}>
                  {isAr ? 'دوام كامل · بيئة عمل مرنة ومحفزة' : 'Full-time · Flexible and innovative work environment'}
                </p>
                <a
                  href={`mailto:${typeof company.contact.emails.hr === 'string' ? company.contact.emails.hr : 'hr@nami-tec.com'}?subject=Application for ${title}`}
                  className={styles.cardLink}
                >
                  {isAr ? 'قدّم سيرتك الذاتية ←' : 'Submit your CV →'}
                </a>
              </div>
            );
          })}
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{isAr ? 'صيغ السيرة الذاتية المقبولة' : 'Accepted CV Formats'}</h2>
        <p className={styles.paragraph}>{company.careers.cvFormats.join(', ')}</p>
      </section>
    </main>
  );
}
