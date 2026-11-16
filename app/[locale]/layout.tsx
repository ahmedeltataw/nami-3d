import type { Metadata } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import type { Locale } from '@/content';
import ExperienceMount from '@/experience/ExperienceMount';
import { RouteTransition } from '@/experience/RouteTransition';
import { LivingCursor } from '@/experience/LivingCursor';
import { Nav } from '@/components/ui/Nav';
import { Footer } from '@/components/ui/Footer';
import { RevealInit } from '@/ui-motion';
import '@/styles/globals.css';
import { inter, plexArabic } from '@/styles/fonts';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://nami-tec.com'),
  title: {
    default: 'Nami 3D',
    template: '%s | Nami 3D',
  },
  description: 'Nami 3D experience',
  openGraph: {
    title: 'Nami 3D',
    description: 'Nami 3D experience',
    url: 'https://nami-tec.com',
    siteName: 'Nami Tech',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nami 3D',
    description: 'Nami 3D experience',
  },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} className={`${plexArabic.variable} ${inter.variable}`}>
      <body>
        <a className="skip-link" href="#main">
          {locale === 'ar' ? 'تخطي إلى المحتوى' : 'Skip to content'}
        </a>
        <NextIntlClientProvider>
          <RouteTransition />
          <ExperienceMount />
          <RevealInit />
          <LivingCursor />
          <Nav />
          {children}
          <Footer locale={locale as Locale} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
