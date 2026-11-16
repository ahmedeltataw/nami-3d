import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getProjects, getProject, textOr, type Locale } from '@/content';
import { buildMetadata, buildCreativeWorkJsonLd, buildBreadcrumbJsonLd, SITE_URL } from '@/lib/metadata';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import styles from '@/styles/page-stub.module.css';

export async function generateStaticParams() {
  const projects = await getProjects('ar');
  return projects.map(project => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const project = await getProject(slug, locale as Locale);
  if (!project) return { title: 'Not Found' };

  const h1Text = project.headings?.find(h => h.level === 'h1')?.text;
  const name: string = typeof h1Text === 'string'
    ? h1Text
    : (typeof project.title === 'string' ? project.title.replace(/\s*\|\s*.*$/, '') : slug);
  const description = textOr(project.description, name);

  return buildMetadata({
    locale: locale as Locale,
    path: `/projects/${slug}`,
    title: `${name} | Nami Tech`,
    description,
  });
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  if (!hasLocale(routing.locales, rawLocale)) notFound();
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  const [project, allProjects, tNav, tContent] = await Promise.all([
    getProject(slug, locale),
    getProjects(locale),
    getTranslations({ locale, namespace: 'Nav' }),
    getTranslations({ locale, namespace: 'ContentPages' }),
  ]);
  if (!project) notFound();

  const isAr = locale === 'ar';
  const h1Text = project.headings?.find(h => h.level === 'h1')?.text;
  const name: string = typeof h1Text === 'string'
    ? h1Text
    : (typeof project.title === 'string' ? project.title.replace(/\s*\|\s*.*$/, '') : slug);
  const description = textOr(project.description);

  const category = typeof project.category === 'string' ? project.category : null;
  const overview = typeof project.overview === 'string' ? project.overview : null;
  const problem = typeof project.problem === 'string' ? project.problem : null;
  const solution = typeof project.solution === 'string' ? project.solution : null;
  const results = typeof project.results === 'string' ? project.results : null;
  const customCta = typeof project.cta === 'string' ? project.cta : null;

  const validServices = project.services.filter((s): s is string => typeof s === 'string');
  const validHighlights = project.highlights.filter((h): h is string => typeof h === 'string');
  const validRelatedSlugs = project.related.filter((r): r is string => typeof r === 'string');
  const relatedProjects = allProjects.filter(p => validRelatedSlugs.includes(p.slug) && p.slug !== slug);

  // Supplementary paragraphs from fields if distinct from overview
  const extraParagraphs = project.paragraphs.filter(
    (p): p is string => typeof p === 'string' && p.trim() !== overview?.trim()
  );

  const projectUrl = `${SITE_URL}/${locale}/projects/${slug}`;
  const primaryImage = project.screens[0]?.url;

  const creativeWorkJsonLd = buildCreativeWorkJsonLd({
    name,
    description: description || name,
    url: projectUrl,
    image: primaryImage,
    locale,
  });

  const breadcrumbs = [
    { label: tNav('home'), href: `/${locale}` },
    { label: tNav('projects'), href: `/${locale}/projects` },
    { label: name },
  ];

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: tNav('home'), url: `${SITE_URL}/${locale}` },
    { name: tNav('projects'), url: `${SITE_URL}/${locale}/projects` },
    { name: name, url: projectUrl },
  ]);

  return (
    <main id="main" className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(creativeWorkJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Breadcrumb items={breadcrumbs} ariaLabel={tContent('breadcrumbAria')} />

      <header className={styles.header}>
        <div className={styles.badge}>{category || (isAr ? 'دراسة حالة' : 'Case Study')}</div>
        <h1 className={styles.title}>{name}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </header>

      {/* 1. Overview */}
      {overview && (
        <section className={styles.section} aria-label={tContent('overview')}>
          <h2 className={styles.sectionTitle}>{tContent('overview')}</h2>
          <p className={styles.paragraph}>{overview}</p>
        </section>
      )}

      {/* 2. Problem (only if documented) */}
      {problem && (
        <section className={styles.section} aria-label={tContent('problem')}>
          <h2 className={styles.sectionTitle}>{tContent('problem')}</h2>
          <p className={styles.paragraph}>{problem}</p>
        </section>
      )}

      {/* 3. Solution (only if documented) */}
      {solution && (
        <section className={styles.section} aria-label={tContent('solution')}>
          <h2 className={styles.sectionTitle}>{tContent('solution')}</h2>
          <p className={styles.paragraph}>{solution}</p>
        </section>
      )}

      {/* 4. Services (only if documented) */}
      {validServices.length > 0 && (
        <section className={styles.section} aria-label={tContent('servicesProvided')}>
          <h2 className={styles.sectionTitle}>{tContent('servicesProvided')}</h2>
          <ul className={styles.list}>
            {validServices.map((serviceName, sIdx) => (
              <li key={sIdx} className={styles.listItem}>
                {serviceName}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Supplementary details / Lists */}
      {extraParagraphs.length > 0 && (
        <section className={styles.section} aria-label={isAr ? 'تفاصيل المشروع' : 'Project Details'}>
          {extraParagraphs.map((p, pIdx) => (
            <p key={pIdx} className={styles.paragraph}>
              {p}
            </p>
          ))}
        </section>
      )}

      {project.lists.map((list, listIdx) => (
        <section key={listIdx} className={styles.section} aria-label={isAr ? 'مواصفات النظام' : 'Specifications'}>
          <ul className={styles.list}>
            {list.items.map((item, itemIdx) =>
              typeof item === 'string' ? (
                <li key={itemIdx} className={styles.listItem}>
                  {item}
                </li>
              ) : null
            )}
          </ul>
        </section>
      ))}

      {/* 5. Screens */}
      {project.screens.length > 0 && (
        <section className={styles.section} aria-label={tContent('screens')}>
          <h2 className={styles.sectionTitle}>{tContent('screens')}</h2>
          <div className={styles.screensGrid}>
            {project.screens.map((screen, sIdx) => {
              const alt = textOr(screen.alt, `${name} screen ${sIdx + 1}`);
              return (
                <div key={sIdx} className={styles.screenCard}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={screen.url}
                    alt={alt}
                    loading="lazy"
                    className={styles.screenImage}
                  />
                  <span className={styles.screenCaption}>{alt}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 6. Highlights (only if documented) */}
      {validHighlights.length > 0 && (
        <section className={styles.section} aria-label={tContent('highlights')}>
          <h2 className={styles.sectionTitle}>{tContent('highlights')}</h2>
          <ul className={styles.list}>
            {validHighlights.map((hl, hlIdx) => (
              <li key={hlIdx} className={styles.listItem}>
                {hl}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 7. Results (only if documented) */}
      {results && (
        <section className={styles.section} aria-label={tContent('results')}>
          <h2 className={styles.sectionTitle}>{tContent('results')}</h2>
          <p className={styles.paragraph}>{results}</p>
        </section>
      )}

      {/* 8. Related Projects (only if documented) */}
      {relatedProjects.length > 0 && (
        <section className={styles.section} aria-label={tContent('relatedProjects')}>
          <h2 className={styles.sectionTitle}>{tContent('relatedProjects')}</h2>
          <div className={styles.grid}>
            {relatedProjects.map(rel => (
              <article key={rel.slug} className={styles.card}>
                <h3 className={styles.cardTitle}>{textOr(rel.title, rel.slug)}</h3>
                <p className={styles.cardDesc}>{textOr(rel.description)}</p>
                <Link href={`/${locale}/projects/${rel.slug}`} className={styles.cardLink}>
                  {isAr ? 'عرض دراسة الحالة ←' : 'View case study →'}
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* 9. CTA */}
      <section className={styles.ctaSection} aria-label={tContent('ctaContactTitle')}>
        <h2 className={styles.ctaTitle}>{customCta || tContent('ctaContactTitle')}</h2>
        <p className={styles.ctaDesc}>{tContent('ctaContactText')}</p>
        <Link href={`/${locale}/contact`} className={styles.ctaButton}>
          {tContent('ctaContactButton')}
        </Link>
      </section>

      <footer className={styles.header}>
        <Link href={`/${locale}/projects`} className={styles.backLink}>
          {tContent('backToProjects')}
        </Link>
      </footer>
    </main>
  );
}
