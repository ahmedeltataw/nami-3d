import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getCompany, type Locale } from '@/content';
import { buildMetadata } from '@/lib/metadata';
import { CareersForm, type CareersRoleOption } from '@/components/forms/CareersForm';
import styles from './careers.module.css';

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

  const roleOptions: CareersRoleOption[] = company.careers.listing.map((job, idx) => {
    const title = isAr
      ? typeof job.title === 'string'
        ? job.title
        : 'مطور برمجيات'
      : typeof job.titleEn === 'string'
        ? job.titleEn
        : 'Software Developer';
    return {
      id: `role-${idx}`,
      title,
    };
  });

  const hrEmail =
    typeof company.contact.emails.hr === 'string' ? company.contact.emails.hr : null;

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

      {/* Role list from content */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          {isAr ? 'الوظائف المتاحة حالياً' : 'Open Positions'}
        </h2>
        {roleOptions.length > 0 ? (
          <div className={styles.rolesGrid}>
            {roleOptions.map(job => (
              <div key={job.id} className={styles.roleCard}>
                <h3 className={styles.roleTitle}>{job.title}</h3>
                <p className={styles.roleDesc}>
                  {isAr
                    ? 'دوام كامل · بيئة عمل مرنة ومحفزة'
                    : 'Full-time · Flexible and innovative work environment'}
                </p>
                <a href="#application-form" className={styles.roleApplyLink}>
                  {isAr ? 'التقديم لهذه الوظيفة ↓' : 'Apply for this position ↓'}
                </a>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.roleDesc}>
            {isAr
              ? 'لا توجد وظائف مفتوحة حالياً، لكننا نرحب دائماً بالتقديم العام عبر النموذج أدناه.'
              : 'There are no active openings right now, but general applications are always welcome below.'}
          </p>
        )}
      </section>

      {/* Application Form with CV file input */}
      <section id="application-form" className={styles.formSection}>
        <CareersForm
          roles={roleOptions}
          hrEmail={hrEmail}
          acceptedFormats={company.careers.cvFormats}
        />
      </section>

      {/* Accepted CV Formats */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>
          {isAr ? 'صيغ السيرة الذاتية المقبولة' : 'Accepted CV Formats'}
        </h2>
        <ul className={styles.formatsList}>
          {company.careers.cvFormats.map(fmt => (
            <li key={fmt} className={styles.formatBadge}>
              {fmt}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
