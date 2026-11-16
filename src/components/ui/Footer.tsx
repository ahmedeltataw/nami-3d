import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getCompany, type Locale } from '@/content';
import styles from './Footer.module.css';

function socialName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    if (host.includes('facebook')) return 'Facebook';
    if (host.includes('linkedin')) return 'LinkedIn';
    if (host.includes('x.com') || host.includes('twitter')) return 'X';
    if (host.includes('instagram')) return 'Instagram';
    if (host.includes('snapchat')) return 'Snapchat';
    if (host.includes('tiktok')) return 'TikTok';
    return host;
  } catch {
    return 'Social';
  }
}

export async function Footer({ locale }: { locale: Locale }) {
  const company = await getCompany(locale);
  const t = await getTranslations({ locale, namespace: 'Footer' });

  const addressSa = typeof company.contact.addresses.sa === 'string' ? company.contact.addresses.sa : null;
  const addressEg = typeof company.contact.addresses.eg === 'string' ? company.contact.addresses.eg : null;
  const whatsapp = typeof company.contact.whatsapp === 'string' ? company.contact.whatsapp : null;

  return (
    <footer className={styles.footer} role="contentinfo">
      <div className={styles.container}>
        <div className={styles.grid}>
          <div className={styles.brandCol}>
            <Link href={`/${locale}`} className={styles.footerLink}>
              <Image
                src="/brand/logo.svg"
                alt="Nami"
                width={120}
                height={41}
                className={styles.logo}
                unoptimized
              />
            </Link>
            <p className={styles.desc}>{t('companyDescription')}</p>
          </div>

          <div className={styles.navCol}>
            <h2 className={styles.colTitle}>{t('quickLinks')}</h2>
            <ul className={styles.linkList}>
              <li>
                <Link href={`/${locale}/services`} className={styles.footerLink}>
                  {locale === 'ar' ? 'الخدمات' : 'Services'}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/projects`} className={styles.footerLink}>
                  {locale === 'ar' ? 'المشاريع' : 'Projects'}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/about`} className={styles.footerLink}>
                  {locale === 'ar' ? 'من نحن' : 'About Us'}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/blog`} className={styles.footerLink}>
                  {locale === 'ar' ? 'المدونة' : 'Blog'}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/careers`} className={styles.footerLink}>
                  {locale === 'ar' ? 'الوظائف' : 'Careers'}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/faqs`} className={styles.footerLink}>
                  {locale === 'ar' ? 'الأسئلة الشائعة' : 'FAQs'}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/contact`} className={styles.footerLink}>
                  {locale === 'ar' ? 'تواصل معنا' : 'Contact Us'}
                </Link>
              </li>
            </ul>
          </div>

          <div className={styles.contactCol}>
            <h2 className={styles.colTitle}>{t('contactTitle')}</h2>

            {addressSa && (
              <div className={styles.contactItem}>
                <span className={styles.contactLabel}>{locale === 'ar' ? 'المملكة العربية السعودية' : 'Saudi Arabia'}</span>
                <span className={styles.contactValue}>{addressSa}</span>
              </div>
            )}

            {addressEg && (
              <div className={styles.contactItem}>
                <span className={styles.contactLabel}>{locale === 'ar' ? 'مصر' : 'Egypt'}</span>
                <span className={styles.contactValue}>{addressEg}</span>
              </div>
            )}

            <div className={styles.contactItem}>
              <span className={styles.contactLabel}>{t('phones')}</span>
              {company.contact.phones.sa.map(phone => (
                <a key={phone} href={`tel:${phone}`} className={styles.contactValue} dir="ltr">
                  {phone}
                </a>
              ))}
              {company.contact.phones.eg.map(phone => (
                <a key={phone} href={`tel:${phone}`} className={styles.contactValue} dir="ltr">
                  {phone}
                </a>
              ))}
            </div>

            <div className={styles.contactItem}>
              <span className={styles.contactLabel}>{t('emails')}</span>
              {typeof company.contact.emails.info === 'string' && (
                <a href={`mailto:${company.contact.emails.info}`} className={styles.contactValue}>
                  {company.contact.emails.info}
                </a>
              )}
              {typeof company.contact.emails.sales === 'string' && (
                <a href={`mailto:${company.contact.emails.sales}`} className={styles.contactValue}>
                  {company.contact.emails.sales}
                </a>
              )}
            </div>

            {whatsapp && (
              <div className={styles.contactItem}>
                <span className={styles.contactLabel}>{t('whatsapp')}</span>
                <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={styles.contactValue}>
                  {whatsapp.replace('https://Wa.me/', '')}
                </a>
              </div>
            )}

            {company.socials.length > 0 && (
              <div className={styles.contactItem}>
                <span className={styles.contactLabel}>{t('social')}</span>
                <ul className={styles.socialsList}>
                  {company.socials.map(url => (
                    <li key={url}>
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.socialLink}
                        aria-label={socialName(url)}
                      >
                        {socialName(url)}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <div className={styles.bottomBar}>
          <div className={styles.legalLinks}>
            <Link href={`/${locale}/privacy`} className={styles.footerLink}>
              {t('privacy')}
            </Link>
            <Link href={`/${locale}/terms`} className={styles.footerLink}>
              {t('terms')}
            </Link>
          </div>
          <p className={styles.copyright}>{t('allRightsReserved')}</p>
        </div>
      </div>
    </footer>
  );
}
