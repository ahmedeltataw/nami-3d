import { describe, expect, it } from 'vitest';
import {
  getServices,
  getService,
  getProjects,
  getProject,
  getBlogPosts,
  getBlogPost,
  getFaqs,
  getPage,
  getLegal,
  textOr,
} from '../../src/content';
import {
  buildServiceJsonLd,
  buildCreativeWorkJsonLd,
  buildArticleJsonLd,
  buildFaqJsonLd,
  buildBreadcrumbJsonLd,
  calculateReadingTime,
  buildMetadata,
} from '../../src/lib/metadata';

describe('JSON-LD builders', () => {
  it('builds valid Service JSON-LD', () => {
    const jsonLd = buildServiceJsonLd({
      name: 'Website Development',
      description: 'Custom modern website design and development.',
      url: 'https://nami-tec.com/en/services/website-development',
      locale: 'en',
    });
    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('Service');
    expect(jsonLd.name).toBe('Website Development');
    expect(jsonLd.provider.name).toBe('Nami Tech');
    expect(jsonLd.provider['@type']).toBe('Organization');
  });

  it('builds valid CreativeWork JSON-LD for projects', () => {
    const jsonLd = buildCreativeWorkJsonLd({
      name: 'Mqane App',
      description: 'Livestock management mobile application.',
      url: 'https://nami-tec.com/en/projects/mqane-app',
      image: 'https://backend.nami-tec.com/storage/images/project/test.webp',
      locale: 'en',
    });
    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('CreativeWork');
    expect(jsonLd.name).toBe('Mqane App');
    expect(jsonLd.image).toBe('https://backend.nami-tec.com/storage/images/project/test.webp');
    expect(jsonLd.creator.name).toBe('Nami Tech');
  });

  it('builds valid Article JSON-LD for blog posts', () => {
    const jsonLd = buildArticleJsonLd({
      headline: 'Web Development Companies Guide',
      description: 'Comprehensive guide to web development standards and costs.',
      url: 'https://nami-tec.com/en/blog/web-dev-guide',
      locale: 'en',
      datePublished: '2026-01-01',
    });
    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('Article');
    expect(jsonLd.headline).toBe('Web Development Companies Guide');
    expect(jsonLd.author.name).toBe('Nami Tech');
    expect(jsonLd.publisher.name).toBe('Nami Tech');
    expect(jsonLd.datePublished).toBe('2026-01-01');
  });

  it('builds valid FAQPage JSON-LD', () => {
    const jsonLd = buildFaqJsonLd([
      {
        question: 'What services does Nami provide?',
        answer: 'Web development, mobile app development, digital marketing, and cloud services.',
      },
    ]);
    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('FAQPage');
    expect(jsonLd.mainEntity).toHaveLength(1);
    expect(jsonLd.mainEntity[0]['@type']).toBe('Question');
    expect(jsonLd.mainEntity[0].name).toBe('What services does Nami provide?');
    expect(jsonLd.mainEntity[0].acceptedAnswer.text).toContain('Web development');
  });

  it('builds valid BreadcrumbList JSON-LD', () => {
    const jsonLd = buildBreadcrumbJsonLd([
      { name: 'Home', url: 'https://nami-tec.com/en' },
      { name: 'Services', url: 'https://nami-tec.com/en/services' },
    ]);
    expect(jsonLd['@context']).toBe('https://schema.org');
    expect(jsonLd['@type']).toBe('BreadcrumbList');
    expect(jsonLd.itemListElement).toHaveLength(2);
    expect(jsonLd.itemListElement[0].position).toBe(1);
    expect(jsonLd.itemListElement[1].position).toBe(2);
  });

  it('computes positive reading time for blog posts', async () => {
    const posts = await getBlogPosts('ar');
    for (const post of posts) {
      const arTime = calculateReadingTime(post, 'ar');
      const enTime = calculateReadingTime(post, 'en');
      expect(arTime.minutes).toBeGreaterThan(0);
      expect(enTime.minutes).toBeGreaterThan(0);
      expect(arTime.text).toContain('للقراءة');
      expect(enTime.text).toContain('min read');
    }
  });
});

describe('content slug coverage', () => {
  for (const locale of ['ar', 'en'] as const) {
    it(`covers all service slugs for ${locale}`, async () => {
      const services = await getServices(locale);
      expect(services.length).toBe(6);
      for (const service of services) {
        expect(service.slug).toBeTruthy();
        const loaded = await getService(service.slug, locale);
        expect(loaded).toBeDefined();
        expect(loaded?.slug).toBe(service.slug);
        const title = textOr(loaded?.title);
        expect(title.length).toBeGreaterThan(0);
        const meta = buildMetadata({
          locale,
          path: `/services/${service.slug}`,
          title: `${title} | Nami Tech`,
          description: textOr(loaded?.description),
        });
        expect(meta.title).toBeTruthy();
      }
    });

    it(`covers all 31 project slugs for ${locale}`, async () => {
      const projects = await getProjects(locale);
      expect(projects.length).toBe(31);
      for (const project of projects) {
        expect(project.slug).toBeTruthy();
        const loaded = await getProject(project.slug, locale);
        expect(loaded).toBeDefined();
        expect(loaded?.slug).toBe(project.slug);
        expect(loaded?.screens.length).toBeGreaterThan(0);
        const meta = buildMetadata({
          locale,
          path: `/projects/${project.slug}`,
          title: `${project.slug} | Nami Tech`,
          description: textOr(loaded?.description),
        });
        expect(meta.title).toBeTruthy();
      }
    });

    it(`covers all 8 blog post slugs for ${locale}`, async () => {
      const posts = await getBlogPosts(locale);
      expect(posts.length).toBe(8);
      for (const post of posts) {
        expect(post.slug).toBeTruthy();
        const loaded = await getBlogPost(post.slug, locale);
        expect(loaded).toBeDefined();
        expect(loaded?.slug).toBe(post.slug);
        expect(loaded?.paragraphs.length).toBeGreaterThan(0);
        const meta = buildMetadata({
          locale,
          path: `/blog/${post.slug}`,
          title: `${textOr(loaded?.title)} | Nami Tech`,
          description: textOr(loaded?.description),
          ogType: 'article',
        });
        expect(meta.title).toBeTruthy();
      }
    });

    it(`loads valid marketing, faq, and legal pages for ${locale}`, async () => {
      const marketing = await getPage('digital-marketing', locale);
      expect(marketing).toBeDefined();
      expect(marketing?.headings.length).toBeGreaterThan(0);

      const faqs = await getFaqs(locale);
      expect(faqs.length).toBeGreaterThan(0);

      const privacy = await getLegal('privacy-policy', locale);
      expect(privacy).toBeDefined();
      expect(privacy?.paragraphs.length).toBeGreaterThan(0);

      const terms = await getLegal('terms-and-conditions', locale);
      expect(terms).toBeDefined();
      expect(terms?.paragraphs.length).toBeGreaterThan(0);
    });
  }
});
