import { describe, expect, it } from 'vitest';
import { redirects } from '../../src/content/redirects';
import { getServices, getProjects, getBlogPosts } from '../../src/content';

describe('redirects configuration', () => {
  it('has redirects defined', () => {
    expect(redirects.length).toBeGreaterThan(0);
    console.log('Redirects count:', redirects.length);
  });

  it('has no self-redirects', () => {
    for (const r of redirects) {
      expect(r.source).not.toBe(r.destination);
    }
  });

  it('has no redirect chains longer than 1 hop', () => {
    const map = new Map(redirects.map(r => [r.source, r.destination]));
    for (const r of redirects) {
      const secondHop = map.get(r.destination);
      if (secondHop) {
        expect.fail(`Redirect chain detected: ${r.source} -> ${r.destination} -> ${secondHop}`);
      }
    }
  });

  it('every redirect destination is a valid sitemap URL pathname', async () => {
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
    const validPathnames = new Set<string>();
    for (const loc of ['ar', 'en']) {
      for (const p of allPaths) {
        validPathnames.add(`/${loc}${p}`);
      }
    }

    const missing: string[] = [];
    for (const r of redirects) {
      if (!validPathnames.has(r.destination)) {
        missing.push(`${r.source} -> ${r.destination}`);
      }
    }
    if (missing.length > 0) {
      console.log('Missing destinations:', missing);
    }
    expect(missing).toEqual([]);
  });
});


