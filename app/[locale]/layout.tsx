import type { Metadata } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import ExperienceMount from '@/experience/ExperienceMount';
import '@/styles/globals.css';
import { inter, plexArabic } from '@/styles/fonts';

export const metadata: Metadata = { title: 'Nami 3D', description: 'Nami 3D experience' };
export function generateStaticParams() { return routing.locales.map((locale) => ({ locale })); }
export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} className={`${plexArabic.variable} ${inter.variable}`}><body><a className="skip-link" href="#main">{locale === 'ar' ? 'تخطي إلى المحتوى' : 'Skip to content'}</a><NextIntlClientProvider><ExperienceMount />{children}</NextIntlClientProvider></body></html>;
}
