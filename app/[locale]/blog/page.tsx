import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getBlogPosts, textOr, type Locale } from '@/content';
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
    path: '/blog',
    title: isAr ? 'المدونة التقنية | نامي تيك' : 'Tech Blog | Nami Tech',
    description: isAr
      ? 'مقالات ودراسات تقنية متخصصة في تطوير البرمجيات وتطبيقات الجوال والمواقع وتجربة المستخدم.'
      : 'Specialized tech articles and insights on software engineering, mobile apps, and UX design.',
  });
}

export default async function BlogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!hasLocale(routing.locales, rawLocale)) notFound();
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  const posts = await getBlogPosts(locale);
  const isAr = locale === 'ar';

  return (
    <main id="main" className={styles.page}>
      <header className={styles.header}>
        <div className={styles.badge}>{isAr ? 'المدونة' : 'Blog'}</div>
        <h1 className={styles.title}>{isAr ? 'المدونة التقنية' : 'Tech Blog'}</h1>
        <p className={styles.description}>
          {isAr
            ? 'مقالات معرفية ونصائح عملية في مجالات التقنية والبرمجة والتصميم لمساعدتك على اتخاذ أفضل القرارات الرقمية.'
            : 'Insights, guides, and practical tips on digital technologies, engineering, and product design.'}
        </p>
      </header>

      <div className={styles.grid}>
        {posts.map(post => {
          const postTitle = textOr(post.title);
          const postDesc = textOr(post.description);
          return (
            <article key={post.slug} className={styles.card}>
              <h2 className={styles.cardTitle}>{postTitle}</h2>
              <p className={styles.cardDesc}>{postDesc}</p>
              <Link href={`/${locale}/blog/${post.slug}`} className={styles.cardLink}>
                {isAr ? 'قراءة المقال ←' : 'Read article →'}
              </Link>
            </article>
          );
        })}
      </div>
    </main>
  );
}
