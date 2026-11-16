import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getProjects, textOr, type Locale } from '@/content';
import { buildMetadata, buildBreadcrumbJsonLd, SITE_URL } from '@/lib/metadata';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import styles from '@/styles/page-stub.module.css';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const isAr = locale === 'ar';
  return buildMetadata({
    locale: locale as Locale,
    path: '/projects',
    title: isAr ? 'أعمالنا ومشاريعنا | نامي تيك' : 'Our Portfolio & Projects | Nami Tech',
    description: isAr
      ? 'استعرض أحدث المشاريع والتطبيقات والمواقع الإلكترونية التي قمنا بتنفيذها بنجاح بأعلى معايير الجودة.'
      : 'Explore the latest portfolio projects, custom web platforms, and mobile apps crafted by Nami Tech.',
  });
}

export default async function ProjectsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!hasLocale(routing.locales, rawLocale)) notFound();
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  const [projects, tNav, tContent] = await Promise.all([
    getProjects(locale),
    getTranslations({ locale, namespace: 'Nav' }),
    getTranslations({ locale, namespace: 'ContentPages' }),
  ]);
  const isAr = locale === 'ar';

  const breadcrumbs = [
    { label: tNav('home'), href: `/${locale}` },
    { label: tNav('projects') },
  ];

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: tNav('home'), url: `${SITE_URL}/${locale}` },
    { name: tNav('projects'), url: `${SITE_URL}/${locale}/projects` },
  ]);

  return (
    <main id="main" className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Breadcrumb items={breadcrumbs} ariaLabel={tContent('breadcrumbAria')} />

      <header className={styles.header}>
        <div className={styles.badge}>{isAr ? 'قصص نجاح' : 'Success Stories'}</div>
        <h1 className={styles.title} data-reveal>{tNav('projects')}</h1>
        <p className={styles.description}>
          {isAr
            ? 'نماذج من المشاريع الرقمية والتطبيقات الذكية التي صممناها وطورناها لشركائنا في مختلف القطاعات.'
            : 'A showcase of innovative digital products, applications, and web platforms engineered for our partners.'}
        </p>
      </header>

      <section aria-label={tNav('projects')} className={styles.section}>
        <div className={styles.grid}>
          {projects.map(project => {
            const h1Text = project.headings?.find(h => h.level === 'h1')?.text;
            const name: string = typeof h1Text === 'string'
              ? h1Text
              : (typeof project.title === 'string' ? project.title.replace(/\s*\|\s*.*$/, '') : project.slug);
            const category = typeof project.category === 'string' ? project.category : null;
            const primaryScreen = project.screens[0];

            return (
              <article key={project.slug} className={styles.card} data-reveal>
                {primaryScreen && (
                  <div className={styles.cardImageWrapper}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={primaryScreen.url}
                      alt={textOr(primaryScreen.alt, name)}
                      loading="lazy"
                      className={styles.cardImage}
                    />
                  </div>
                )}
                {category && <span className={styles.badge}>{category}</span>}
                <h2 className={styles.cardTitle}>{name}</h2>
                <p className={styles.cardDesc}>{textOr(project.description)}</p>
                <Link href={`/${locale}/projects/${project.slug}`} className={styles.cardLink}>
                  {isAr ? 'عرض دراسة الحالة ←' : 'View case study →'}
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.ctaSection} aria-label={tContent('ctaContactTitle')}>
        <h2 className={styles.ctaTitle} data-reveal>{tContent('ctaContactTitle')}</h2>
        <p className={styles.ctaDesc}>{tContent('ctaContactText')}</p>
        <Link href={`/${locale}/contact`} className={styles.ctaButton}>
          {tContent('ctaContactButton')}
        </Link>
      </section>
    </main>
  );
}
