import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { parityErrors } from './content-parity.mjs';
import { assertUniqueSlug } from './content-slugs.mjs';

const read = async path => JSON.parse(await readFile(path, 'utf8'));
const missing = { status: 'missing' };
function projectScreens(images) {
  const seen = new Set();
  return images.flatMap(image => {
    let url = image.url;
    try {
      const parsed = new URL(url, 'https://nami-tec.com');
      if (parsed.pathname === '/_next/image') url = parsed.searchParams.get('url') ?? url;
      const source = new URL(url, 'https://nami-tec.com');
      if (!source.pathname.includes('/storage/images/project/') || seen.has(source.href)) return [];
      seen.add(source.href);
      return [{ url: source.href, alt: text(image.alt) }];
    } catch { return []; }
  });
}
const text = value => typeof value === 'string' && value.trim() && value !== 'missing' ? value.trim() : missing;
// These blocks occur in the inventory on every page, both before and after page content.
const footerHeadings = new Set(['الخدمات', 'الروابط', 'بريد التواصل', 'Services', 'Links', 'Contact Emails']);
const footerParagraphs = new Set([
  'مؤسسة نامي تقدم حلولاً برمجية متكاملة للمواقع وتطبيقات الجوال لمساعدة الشركات على النمو الرقمي بمنتجات موثوقة.',
  '© 2026 جميع الحقوق محفوظة - نامي لتطوير البرمجيات',
  'Nami provides integrated software solutions for web and mobile applications, helping companies scale with reliable digital products.',
  '© 2026 All rights reserved - Nami Software Development'
]);
const chromeLists = new Set([
  ['تطوير المواقع', 'تطوير تطبيقات الهواتف', 'التسويق الرقمي', 'الاستشارات التقنية', 'خدمات السحابة', 'خدمات التصميم'],
  ['الرئيسية', 'من نحن', 'المدونة', 'الأسئلة الشائعة', 'خدماتنا', 'تواصل معنا', 'سياسة الخصوصية', 'الشروط والأحكام'],
  ['الدعم الفني', 'الموارد البشرية', 'التسويق والمبيعات'],
  ['Website development', 'Mobile application development', 'Digital marketing', 'Technical consulting', 'Cloud services', 'Design services'],
  ['Home', 'About Us', 'Blogs', 'FAQs', 'Services', 'Contact Us', 'Privacy Policy', 'Terms & Conditions'],
  ['Technical Support', 'Human Resources', 'Marketing & Sales']
].map(items => JSON.stringify(items)));
const routes = await read('content-inventory/routes.json');
const rawCompany = await read('content-inventory/company.json');
const files = (await readdir('content-inventory/content')).filter(name => name.endsWith('.json')).sort();
const docs = await Promise.all(files.map(name => read(`content-inventory/content/${name}`)));
const byUrl = new Map(docs.map(doc => [doc.oldUrl, doc]));
const company = {
  foundedYear: rawCompany.foundedYear,
  vision: { ar: text(rawCompany.vision.ar), en: text(rawCompany.vision.en) },
  mission: { ar: text(rawCompany.mission.ar), en: text(rawCompany.mission.en) },
  values: rawCompany.coreValues.map((v, i) => ({ id: `value-${i + 1}`, name: { ar: text(v.ar.name), en: text(v.en.name) }, description: { ar: text(v.ar.description), en: text(v.en.description) } })),
  contact: { addresses: { sa: text(rawCompany.contact.addresses.sa), eg: text(rawCompany.contact.addresses.eg) }, phones: rawCompany.contact.phones, whatsapp: text(rawCompany.contact.whatsapp), emails: Object.fromEntries(Object.entries(rawCompany.contact.emails).map(([k,v]) => [k, text(v)])) },
  socials: rawCompany.contact.socialUrls, careers: rawCompany.careers
};
const outputs = {};
for (const locale of ['ar', 'en']) {
  const result = { services: [], projects: [], blog: [], faq: [], legal: [], pages: [], company };
  const slugs = new Map();
  for (const route of routes.filter(r => r.locale === locale && r.kind !== 'careers')) {
    assertUniqueSlug(slugs, route, locale);
    const doc = byUrl.get(route.oldUrl);
    if (!doc) throw new Error(`Missing inventory content: ${route.oldUrl}`);
    const entry = { slug: route.newSlug, oldId: route.oldId, title: text(doc.title), description: text(doc.meta?.description), sourceUrl: doc.oldUrl,
      headings: doc.fields.headings.filter(h => !(h.level === 'h5' && footerHeadings.has(h.text))).map(h => ({ level: h.level, text: text(h.text) })), paragraphs: doc.fields.paragraphs.filter(p => !footerParagraphs.has(p)).map(text), lists: doc.fields.lists.filter(l => !(l.type === 'ul' && chromeLists.has(JSON.stringify(l.items)))).map(l => ({ type: l.type, items: l.items.map(text) })) };
    if (route.kind === 'project') Object.assign(entry, { overview: text(doc.meta?.description), problem: missing, solution: missing, services: [], screens: projectScreens(doc.images), highlights: [], results: missing, related: [], cta: missing, category: missing });
    const key = { service: 'services', project: 'projects', blog: 'blog', faq: 'faq', legal: 'legal', page: 'pages' }[route.kind];
    if (!key) throw new Error(`Unknown route kind ${route.kind}`);
    result[key].push(entry);
  }
  outputs[locale] = result;
}
const errors = parityErrors(outputs.ar, outputs.en);
if (errors.length) throw new Error(`Locale parity failed:\n${errors.join('\n')}`);
for (const locale of ['ar', 'en']) {
  await mkdir(`src/content/${locale}`, { recursive: true });
  for (const [key, value] of Object.entries(outputs[locale])) await writeFile(`src/content/${locale}/${key}.json`, `${JSON.stringify(value, null, 2)}\n`);
}
await writeFile('src/content/provenance.json', `${JSON.stringify(await read('content-inventory/provenance.json'), null, 2)}\n`);
console.log('Content normalized:', Object.fromEntries(Object.entries(outputs.ar).filter(([k]) => k !== 'company').map(([k,v]) => [k,v.length])), 'per locale');
