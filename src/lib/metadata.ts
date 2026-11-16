import type { Metadata } from 'next';
import type { Locale } from '@/content';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://nami-tec.com';

export function buildMetadata({
  locale,
  path,
  title,
  description,
  ogType = 'website',
}: {
  locale: Locale;
  path: string;
  title: string;
  description: string;
  ogType?: 'website' | 'article';
}): Metadata {
  const normalizedPath = path.startsWith('/') ? path : (path ? `/${path}` : '');
  const canonicalUrl = `${SITE_URL}/${locale}${normalizedPath}`;
  const arUrl = `${SITE_URL}/ar${normalizedPath}`;
  const enUrl = `${SITE_URL}/en${normalizedPath}`;

  const siteName = locale === 'ar' ? 'نامي تيك' : 'Nami Tech';

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        ar: arUrl,
        en: enUrl,
        'x-default': arUrl,
      },
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName,
      locale: locale === 'ar' ? 'ar_AR' : 'en_US',
      type: ogType,
    },
  };
}
