import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getCompany, getPage, type Locale } from '@/content';
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
  const page = await getPage('contact-us', locale as Locale);
  return buildMetadata({
    locale: locale as Locale,
    path: '/contact',
    title: isAr ? 'تواصل معنا | نامي تيك' : 'Contact Us | Nami Tech',
    description: typeof page?.description === 'string'
      ? page.description
      : (isAr ? 'تواصل مع فريق نامي تيك للاستشارات البرمجية وبدء مشروعك التقني.' : 'Get in touch with Nami Tech team for software consulting and starting your project.'),
  });
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!hasLocale(routing.locales, rawLocale)) notFound();
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  const [company, page] = await Promise.all([
    getCompany(locale),
    getPage('contact-us', locale),
  ]);

  const isAr = locale === 'ar';
  const title = typeof page?.headings?.[0]?.text === 'string'
    ? page.headings[0].text
    : (isAr ? 'تواصل معنا' : 'Contact Us');

  const addressSa = typeof company.contact.addresses.sa === 'string' ? company.contact.addresses.sa : null;
  const addressEg = typeof company.contact.addresses.eg === 'string' ? company.contact.addresses.eg : null;
  const whatsapp = typeof company.contact.whatsapp === 'string' ? company.contact.whatsapp : null;

  return (
    <main id="main" className={styles.page}>
      <header className={styles.header}>
        <div className={styles.badge}>{isAr ? 'تواصل' : 'Contact'}</div>
        <h1 className={styles.title}>{title}</h1>
        {typeof page?.description === 'string' && (
          <p className={styles.description}>{page.description}</p>
        )}
      </header>

      <div className={styles.grid}>
        {addressSa && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{isAr ? 'المقر الرئيسي (السعودية)' : 'Headquarters (Saudi Arabia)'}</h2>
            <p className={styles.cardDesc}>{addressSa}</p>
          </div>
        )}

        {addressEg && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{isAr ? 'فرع مصر' : 'Egypt Office'}</h2>
            <p className={styles.cardDesc}>{addressEg}</p>
          </div>
        )}

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{isAr ? 'أرقام الاتصال' : 'Phone Numbers'}</h2>
          {company.contact.phones.sa.map(p => (
            <a key={p} href={`tel:${p}`} className={styles.cardLink} dir="ltr">
              {p}
            </a>
          ))}
          {company.contact.phones.eg.map(p => (
            <a key={p} href={`tel:${p}`} className={styles.cardLink} dir="ltr">
              {p}
            </a>
          ))}
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>{isAr ? 'البريد الإلكتروني' : 'Email Addresses'}</h2>
          {typeof company.contact.emails.info === 'string' && (
            <a href={`mailto:${company.contact.emails.info}`} className={styles.cardLink}>
              {company.contact.emails.info}
            </a>
          )}
          {typeof company.contact.emails.sales === 'string' && (
            <a href={`mailto:${company.contact.emails.sales}`} className={styles.cardLink}>
              {company.contact.emails.sales}
            </a>
          )}
          {typeof company.contact.emails.hr === 'string' && (
            <a href={`mailto:${company.contact.emails.hr}`} className={styles.cardLink}>
              {company.contact.emails.hr}
            </a>
          )}
        </div>

        {whatsapp && (
          <div className={styles.card}>
            <h2 className={styles.cardTitle}>{isAr ? 'واتساب' : 'WhatsApp'}</h2>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={styles.cardLink}>
              {whatsapp}
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
