import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getBlogPosts, getBlogPost, textOr, type Locale } from '@/content';
import { buildMetadata } from '@/lib/metadata';
import styles from '@/styles/page-stub.module.css';

export async function generateStaticParams() {
  const posts = await getBlogPosts('ar');
  return posts.map(post => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const post = await getBlogPost(slug, locale as Locale);
  if (!post) return { title: 'Not Found' };

  const title = textOr(post.title, slug);
  const description = textOr(post.description, title);

  return buildMetadata({
    locale: locale as Locale,
    path: `/blog/${slug}`,
    title: `${title} | Nami Tech`,
    description,
    ogType: 'article',
  });
}

export default async function BlogPostDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  if (!hasLocale(routing.locales, rawLocale)) notFound();
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  const post = await getBlogPost(slug, locale);
  if (!post) notFound();

  const isAr = locale === 'ar';
  const title = textOr(post.title, slug);
  const description = textOr(post.description);

  return (
    <main id="main" className={styles.page}>
      <header className={styles.header}>
        <div className={styles.badge}>{isAr ? 'مقال' : 'Article'}</div>
        <h1 className={styles.title}>{title}</h1>
        {description && <p className={styles.description}>{description}</p>}
      </header>

      {post.paragraphs.length > 0 && (
        <section className={styles.section}>
          {post.paragraphs.map((p, index) =>
            typeof p === 'string' ? (
              <p key={index} className={styles.paragraph}>
                {p}
              </p>
            ) : null
          )}
        </section>
      )}

      {post.lists.map((list, listIdx) => (
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

      <footer className={styles.header}>
        <Link href={`/${locale}/blog`} className={styles.cardLink}>
          {isAr ? '← العودة للمدونة' : '← Back to blog'}
        </Link>
      </footer>
    </main>
  );
}
