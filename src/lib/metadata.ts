import type { Metadata } from 'next';
import type { Locale, BlogPost } from '@/content';

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://nami-tec.com';

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

export interface ServiceJsonLdParams {
  name: string;
  description: string;
  url: string;
  locale: Locale;
}

export function buildServiceJsonLd({
  name,
  description,
  url,
  locale,
}: ServiceJsonLdParams) {
  const providerName = locale === 'ar' ? 'نامي تيك' : 'Nami Tech';
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    description,
    url,
    provider: {
      '@type': 'Organization',
      name: providerName,
      url: `${SITE_URL}/${locale}`,
    },
  };
}

export interface CreativeWorkJsonLdParams {
  name: string;
  description: string;
  url: string;
  image?: string;
  locale: Locale;
}

export function buildCreativeWorkJsonLd({
  name,
  description,
  url,
  image,
  locale,
}: CreativeWorkJsonLdParams) {
  const creatorName = locale === 'ar' ? 'نامي تيك' : 'Nami Tech';
  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name,
    description,
    url,
    ...(image ? { image } : {}),
    creator: {
      '@type': 'Organization',
      name: creatorName,
      url: `${SITE_URL}/${locale}`,
    },
  };
}

export interface ArticleJsonLdParams {
  headline: string;
  description: string;
  url: string;
  locale: Locale;
  datePublished?: string;
  image?: string;
}

export function buildArticleJsonLd({
  headline,
  description,
  url,
  locale,
  datePublished,
  image,
}: ArticleJsonLdParams) {
  const orgName = locale === 'ar' ? 'نامي تيك' : 'Nami Tech';
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    description,
    url,
    ...(datePublished ? { datePublished } : {}),
    ...(image ? { image } : {}),
    author: {
      '@type': 'Organization',
      name: orgName,
      url: `${SITE_URL}/${locale}`,
    },
    publisher: {
      '@type': 'Organization',
      name: orgName,
      url: `${SITE_URL}/${locale}`,
    },
  };
}

export interface FaqItem {
  question: string;
  answer: string;
}

export function buildFaqJsonLd(items: FaqItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

export interface BreadcrumbListItem {
  name: string;
  url: string;
}

export function buildBreadcrumbJsonLd(items: BreadcrumbListItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function calculateReadingTime(post: BlogPost, locale: Locale): { minutes: number; text: string } {
  let wordCount = 0;
  if (typeof post.title === 'string') {
    wordCount += post.title.split(/\s+/).filter(Boolean).length;
  }
  if (typeof post.description === 'string') {
    wordCount += post.description.split(/\s+/).filter(Boolean).length;
  }
  for (const p of post.paragraphs) {
    if (typeof p === 'string') {
      wordCount += p.split(/\s+/).filter(Boolean).length;
    }
  }
  for (const list of post.lists) {
    for (const item of list.items) {
      if (typeof item === 'string') {
        wordCount += item.split(/\s+/).filter(Boolean).length;
      }
    }
  }

  const speed = locale === 'ar' ? 160 : 200;
  const minutes = Math.max(1, Math.ceil(wordCount / speed));

  let text: string;
  if (locale === 'ar') {
    if (minutes === 1) text = 'دقيقة واحدة للقراءة';
    else if (minutes === 2) text = 'دقيقتان للقراءة';
    else if (minutes <= 10) text = `${minutes} دقائق للقراءة`;
    else text = `${minutes} دقيقة للقراءة`;
  } else {
    text = `${minutes} min read`;
  }

  return { minutes, text };
}
