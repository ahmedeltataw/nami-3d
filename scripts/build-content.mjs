import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { parityErrors } from './content-parity.mjs';

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
  for (const route of routes.filter(r => r.locale === locale && r.kind !== 'careers')) {
    const doc = byUrl.get(route.oldUrl);
    if (!doc) throw new Error(`Missing inventory content: ${route.oldUrl}`);
    const entry = { slug: route.newSlug, oldId: route.oldId, title: text(doc.title), description: text(doc.meta?.description), sourceUrl: doc.oldUrl,
      headings: doc.fields.headings.map(h => ({ level: h.level, text: text(h.text) })), paragraphs: doc.fields.paragraphs.map(text), lists: doc.fields.lists.map(l => ({ type: l.type, items: l.items.map(text) })) };
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
