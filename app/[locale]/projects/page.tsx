import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getProjects, textOr, type Locale } from '@/content';
import { buildMetadata } from '@/lib/metadata';
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
    title: isAr ? 'أعمالنا ومشاريعنا | نامي تيك' : 'Our Projects | Nami Tech',
    description: isAr
      ? 'استعرض أحدث المشاريع والتطبيقات والمواقع الإلكترونية التي قمنا بتنفيذها بنجاح.'
      : 'Explore the latest portfolio projects, mobile apps, and web applications developed by Nami.',
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

  const projects = await getProjects(locale);
  const isAr = locale === 'ar';

  return (
    <main id="main" className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>{isAr ? 'أعمالنا ومشاريعنا' : 'Our Projects'}</h1>
        <p className={styles.description}>
          {isAr
            ? 'نماذج من المشاريع الرقمية التي صممناها وطورناها لشركائنا في مختلف المجالات.'
            : 'A showcase of innovative digital products we have designed and built for our partners.'}
        </p>
      </header>

      <div className={styles.grid}>
        {projects.map(project => {
          const h1Text = project.headings?.find(h => h.level === 'h1')?.text;
          const name: string = typeof h1Text === 'string'
            ? h1Text
            : (typeof project.title === 'string' ? project.title.replace(/\s*\|\s*.*$/, '') : project.slug);
          const category = typeof project.category === 'string' ? project.category : null;

          return (
            <article key={project.slug} className={styles.card}>
              {category && <span className={styles.badge}>{category}</span>}
              <h2 className={styles.cardTitle}>{name}</h2>
              <p className={styles.cardDesc}>{textOr(project.description)}</p>
              <Link href={`/${locale}/projects/${project.slug}`} className={styles.cardLink}>
                {isAr ? 'عرض تفاصيل المشروع ←' : 'View project details →'}
              </Link>
            </article>
          );
        })}
      </div>
    </main>
  );
}
