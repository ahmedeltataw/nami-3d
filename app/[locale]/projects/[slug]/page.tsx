import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getProjects, getProject, textOr, type Locale } from '@/content';
import { buildMetadata } from '@/lib/metadata';
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

  const project = await getProject(slug, locale);
  if (!project) notFound();

  const isAr = locale === 'ar';
  const h1Text = project.headings?.find(h => h.level === 'h1')?.text;
  const name: string = typeof h1Text === 'string'
    ? h1Text
    : (typeof project.title === 'string' ? project.title.replace(/\s*\|\s*.*$/, '') : slug);
  const description = textOr(project.description);

  return (
    <main id="main" className={styles.page}>
      <header className={styles.header}>
        <div className={styles.badge}>{isAr ? 'مشروع' : 'Project'}</div>
        <h1 className={styles.title}>{name}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </header>

      {typeof project.overview === 'string' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{isAr ? 'نظرة عامة' : 'Overview'}</h2>
          <p className={styles.paragraph}>{project.overview}</p>
        </section>
      )}

      {project.paragraphs.length > 0 && (
        <section className={styles.section}>
          {project.paragraphs.map((p, index) =>
            typeof p === 'string' ? (
              <p key={index} className={styles.paragraph}>
                {p}
              </p>
            ) : null
          )}
        </section>
      )}

      {project.lists.map((list, listIdx) => (
        <section key={listIdx} className={styles.section}>
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

      {project.screens.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{isAr ? 'شاشات المشروع' : 'Screenshots'}</h2>
          <div className={styles.grid}>
            {project.screens.map((screen, sIdx) => (
              <div key={sIdx} className={styles.card}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={screen.url}
                  alt={textOr(screen.alt, name)}
                  loading="lazy"
                  style={{ inlineSize: '100%', blockSize: 'auto', borderRadius: 'var(--radius-sm)' }}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <footer className={styles.header}>
        <Link href={`/${locale}/projects`} className={styles.cardLink}>
          {isAr ? '← العودة لجميع المشاريع' : '← Back to all projects'}
        </Link>
      </footer>
    </main>
  );
}
