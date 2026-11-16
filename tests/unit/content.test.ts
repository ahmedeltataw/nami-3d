import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { BlogPostSchema, CompanySchema, FaqSchema, LegalSchema, PageSchema, ProjectSchema, ProvenanceSchema, ServiceSchema } from '../../src/content/schema';
import { getBlogPost, getProject, getServices } from '../../src/content';
import { redirects, routeMappings } from '../../src/content/redirects';
import { parityErrors } from '../../scripts/content-parity.mjs';
import { assertUniqueSlug } from '../../scripts/content-slugs.mjs';
import routes from '../../content-inventory/routes.json';

const schemas = { services: z.array(ServiceSchema), projects: z.array(ProjectSchema), blog: z.array(BlogPostSchema), faq: z.array(FaqSchema), legal: z.array(LegalSchema), pages: z.array(PageSchema), company: CompanySchema };
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
describe('content', () => {
  it('validates every generated file', () => {
    for (const locale of ['ar', 'en']) for (const [kind, schema] of Object.entries(schemas)) expect(schema.safeParse(read(`src/content/${locale}/${kind}.json`)).success, `${locale}/${kind}`).toBe(true);
    expect(ProvenanceSchema.safeParse(read('src/content/provenance.json')).success).toBe(true);
  });
  it('rejects unknown keys and empty text', () => {
    const service = read('src/content/en/services.json')[0];
    expect(ServiceSchema.safeParse({ ...service, unexpected: true }).success).toBe(false);
    expect(ServiceSchema.safeParse({ ...service, title: '' }).success).toBe(false);
  });
  it('detects missing translated keys', () => {
    const ar = { record: { title: 'عنوان', description: 'وصف' } };
    const en = { record: { title: 'Title' } };
    expect(parityErrors(ar, en)).toContain('record.description missing in en');
    expect(parityErrors({ rows: [{ text: 'x', level: 'h1' }] }, { rows: [{ text: 'y' }] })).toContain('rows[ar:0].level missing in en');
  });
  it('loads valid data and distinct blog slugs', async () => {
    expect(await getServices('en')).toHaveLength(6);
    expect((await getProject('shohnatk', 'ar'))?.oldId).toBe('165');
    const project = await getProject('shohnatk', 'en');
    expect(project?.screens.length).toBeGreaterThan(0);
    expect(project?.screens.every(screen => screen.url.includes('/storage/images/project/'))).toBe(true);
    expect(new Set(project?.screens.map(screen => screen.url)).size).toBe(project?.screens.length);
    for (const locale of ['ar', 'en'] as const) {
      expect((await getBlogPost('mobile-app-development-companies-saudi', locale))?.oldId).toBe('4');
      expect((await getBlogPost('web-app-development-solutions', locale))?.oldId).toBe('5');
    }
  });
  it('rejects duplicate slugs within a kind', () => {
    const seen = new Map<string, string>();
    const route = { kind: 'blog', newSlug: 'duplicate', oldUrl: '/first' };
    assertUniqueSlug(seen, route, 'en');
    expect(() => assertUniqueSlug(seen, { ...route, oldUrl: '/second' }, 'en')).toThrow('Duplicate blog slug');
    expect(() => assertUniqueSlug(seen, { ...route, kind: 'project' }, 'en')).not.toThrow();
  });
  it('removes repeated footer and navigation blocks from every content file', () => {
    const headings = new Set(['الخدمات', 'الروابط', 'بريد التواصل', 'Services', 'Links', 'Contact Emails']);
    const paragraphs = new Set([
      'مؤسسة نامي تقدم حلولاً برمجية متكاملة للمواقع وتطبيقات الجوال لمساعدة الشركات على النمو الرقمي بمنتجات موثوقة.',
      'Nami provides integrated software solutions for web and mobile applications, helping companies scale with reliable digital products.'
    ]);
    const navLists = new Set([
      'تطوير المواقع|تطوير تطبيقات الهواتف|التسويق الرقمي|الاستشارات التقنية|خدمات السحابة|خدمات التصميم',
      'الرئيسية|من نحن|المدونة|الأسئلة الشائعة|خدماتنا|تواصل معنا|سياسة الخصوصية|الشروط والأحكام',
      'الدعم الفني|الموارد البشرية|التسويق والمبيعات',
      'Website development|Mobile application development|Digital marketing|Technical consulting|Cloud services|Design services',
      'Home|About Us|Blogs|FAQs|Services|Contact Us|Privacy Policy|Terms & Conditions',
      'Technical Support|Human Resources|Marketing & Sales'
    ]);
    for (const locale of ['ar', 'en']) for (const kind of ['services', 'projects', 'blog', 'faq', 'legal', 'pages']) {
      const entries = read(`src/content/${locale}/${kind}.json`) as { headings: { level: string; text: string }[]; paragraphs: unknown[]; lists: { items: string[] }[] }[];
      for (const entry of entries) {
        expect(entry.headings.some(h => h.level === 'h5' && headings.has(h.text))).toBe(false);
        expect(entry.paragraphs.some(p => typeof p === 'string' && (paragraphs.has(p) || p.includes('© 2026')))).toBe(false);
        expect(entry.lists.some(list => navLists.has(list.items.join('|')))).toBe(false);
      }
    }
  });
  it('classifies all inventoried routes without duplicates or redirect loops', () => {
    expect(routeMappings).toHaveLength(routes.length);
    expect(new Set(routeMappings.map(r => r.source)).size).toBe(routes.length);
    const sources = new Set(redirects.map(r => r.source));
    expect(redirects.every(r => r.source !== r.destination && !sources.has(r.destination))).toBe(true);
    expect(routeMappings.filter(r => r.kind === 'fragment')).toHaveLength(2);
  });
});
