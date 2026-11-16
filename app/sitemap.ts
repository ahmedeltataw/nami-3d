import type { MetadataRoute } from 'next';
import { getServices, getProjects, getBlogPosts } from '@/content';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nami-tec.com';
  const locales = ['ar', 'en'] as const;

  const staticPaths = [
    '',
    '/services',
    '/projects',
    '/about',
    '/contact',
    '/careers',
    '/blog',
    '/marketing',
    '/faqs',
    '/privacy',
    '/terms',
  ];

  const [services, projects, blogPosts] = await Promise.all([
    getServices('ar'),
    getProjects('ar'),
    getBlogPosts('ar'),
  ]);

  const allPaths = [
    ...staticPaths,
    ...services.map(s => `/services/${s.slug}`),
    ...projects.map(p => `/projects/${p.slug}`),
    ...blogPosts.map(b => `/blog/${b.slug}`),
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const path of allPaths) {
      entries.push({
        url: `${baseUrl}/${locale}${path}`,
        lastModified: new Date(),
        changeFrequency: path === '' ? 'daily' : 'weekly',
        priority: path === '' ? 1.0 : path.split('/').length > 2 ? 0.7 : 0.8,
        alternates: {
          languages: {
            ar: `${baseUrl}/ar${path}`,
            en: `${baseUrl}/en${path}`,
          },
        },
      });
    }
  }

  return entries;
}
