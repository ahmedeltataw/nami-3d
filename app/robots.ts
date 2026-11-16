import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nami-tec.com';
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/styleguide'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
