import type { AbstractIntlMessages } from 'next-intl';

// One namespace per line keeps scene copy changes independent.
const namespaces = [
  'Common',
  'ContentPages',
  'Nav',
  'Home',
  'Footer',
  'Contact',
  'Careers',
  'Forms',
  'website-development',
  'mobile-application-development',
  'digital-marketing',
  'technical-consulting',
  'cloud-services',
  'design-services',
  'Motion',
  'ExperienceControls',
  'Sound',
] as const;

export async function loadMessages(locale: 'ar' | 'en'): Promise<AbstractIntlMessages> {
  const base = (await import(`../messages/${locale}.json`)).default;
  const entries = await Promise.all(namespaces.map(async namespace => [
    namespace, (await import(`../messages/${namespace}.${locale}.json`)).default,
  ] as const));
  return { ...base, ...Object.fromEntries(entries) };
}
