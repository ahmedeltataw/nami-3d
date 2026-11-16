import { z } from 'zod';

export const LocaleSchema = z.enum(['ar', 'en']);
export type Locale = z.infer<typeof LocaleSchema>;
export const MissingSchema = z.strictObject({ status: z.literal('missing') });
export const TextSchema = z.union([z.string().trim().min(1), MissingSchema]);
const bilingual = z.strictObject({ ar: TextSchema, en: TextSchema });
const nonempty = z.string().trim().min(1);
const slug = nonempty.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const common = { slug, oldId: z.string().min(1).nullable(), title: TextSchema, description: TextSchema, sourceUrl: nonempty };
const body = { headings: z.array(z.strictObject({ level: nonempty, text: TextSchema })), paragraphs: z.array(TextSchema), lists: z.array(z.strictObject({ type: nonempty, items: z.array(TextSchema) })) };
export const ServiceSchema = z.strictObject({ ...common, ...body });
export const ProjectSchema = z.strictObject({ ...common, overview: TextSchema, problem: TextSchema, solution: TextSchema, services: z.array(TextSchema), screens: z.array(z.strictObject({ url: nonempty, alt: TextSchema })), highlights: z.array(TextSchema), results: TextSchema, related: z.array(TextSchema), cta: TextSchema, category: TextSchema, ...body });
export const BlogPostSchema = z.strictObject({ ...common, ...body });
export const FaqSchema = z.strictObject({ ...common, ...body });
export const LegalSchema = z.strictObject({ ...common, ...body });
export const PageSchema = z.strictObject({ ...common, ...body });
export const CompanySchema = z.strictObject({
  foundedYear: z.number().int(), vision: bilingual, mission: bilingual,
  values: z.array(z.strictObject({ id: nonempty, name: bilingual, description: bilingual })).length(7),
  contact: z.strictObject({ addresses: z.strictObject({ sa: TextSchema, eg: TextSchema }), phones: z.strictObject({ sa: z.array(nonempty), eg: z.array(nonempty) }), whatsapp: TextSchema, emails: z.strictObject({ info: TextSchema, hr: TextSchema, sales: TextSchema }) }),
  socials: z.array(nonempty),
  careers: z.strictObject({ sectionAnchor: nonempty, listing: z.array(z.strictObject({ title: TextSchema, titleEn: TextSchema })), applicationFields: z.strictObject({ ar: z.array(TextSchema), en: z.array(TextSchema) }), cvFormats: z.array(nonempty), sourcePage: nonempty })
});
export const ProvenanceSchema = z.record(nonempty, z.strictObject({ sourceUrl: nonempty, fetchedAt: nonempty, method: nonempty }));
export type Company = z.infer<typeof CompanySchema>;
export type Service = z.infer<typeof ServiceSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type BlogPost = z.infer<typeof BlogPostSchema>;
export type Faq = z.infer<typeof FaqSchema>;
export type Legal = z.infer<typeof LegalSchema>;
export type Page = z.infer<typeof PageSchema>;
export type Provenance = z.infer<typeof ProvenanceSchema>;
