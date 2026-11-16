import { z } from 'zod';
import { BlogPostSchema, CompanySchema, FaqSchema, LegalSchema, LocaleSchema, PageSchema, ProjectSchema, ServiceSchema, type Locale } from './schema';

export * from './schema';
const files = {
  ar: { services: () => import('./ar/services.json'), projects: () => import('./ar/projects.json'), blog: () => import('./ar/blog.json'), faq: () => import('./ar/faq.json'), legal: () => import('./ar/legal.json'), pages: () => import('./ar/pages.json'), company: () => import('./ar/company.json') },
  en: { services: () => import('./en/services.json'), projects: () => import('./en/projects.json'), blog: () => import('./en/blog.json'), faq: () => import('./en/faq.json'), legal: () => import('./en/legal.json'), pages: () => import('./en/pages.json'), company: () => import('./en/company.json') }
};
const schemas = { services: z.array(ServiceSchema), projects: z.array(ProjectSchema), blog: z.array(BlogPostSchema), faq: z.array(FaqSchema), legal: z.array(LegalSchema), pages: z.array(PageSchema), company: CompanySchema };
async function load<K extends keyof typeof schemas>(kind: K, locale: Locale): Promise<z.infer<(typeof schemas)[K]>> {
  const checkedLocale = LocaleSchema.parse(locale);
  const data = (await files[checkedLocale][kind]()).default;
  const result = schemas[kind].safeParse(data);
  if (!result.success) throw new Error(`Invalid ${checkedLocale}/${kind} content: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  return result.data as z.infer<(typeof schemas)[K]>;
}
function find<T extends { slug: string }>(items: T[], slug: string): T | undefined {
  const found = items.filter(item => item.slug === slug);
  if (found.length > 1) throw new Error(`Ambiguous content slug: ${slug}`);
  return found[0];
}
export const getServices = (locale: Locale) => load('services', locale);
export const getService = async (slug: string, locale: Locale) => find(await getServices(locale), slug);
export const getProjects = (locale: Locale) => load('projects', locale);
export const getProject = async (slug: string, locale: Locale) => find(await getProjects(locale), slug);
export const getBlogPosts = (locale: Locale) => load('blog', locale);
export const getBlogPost = async (slug: string, locale: Locale) => find(await getBlogPosts(locale), slug);
export const getFaqs = (locale: Locale) => load('faq', locale);
export const getLegal = async (slug: string, locale: Locale) => find(await load('legal', locale), slug);
export const getCompany = (locale: Locale) => load('company', locale);
export const isText = (value: unknown): value is string => typeof value === 'string';
export const textOr = (value: unknown, fallback = ''): string => (typeof value === 'string' ? value : fallback);
export const HOME_PAGE_SLUG = 'top-app-web-development-company-in-egypt-and-the-arab-world';
export const getPage = async (slug: string, locale: Locale) => find(await load('pages', locale), slug === 'home' ? HOME_PAGE_SLUG : slug);
