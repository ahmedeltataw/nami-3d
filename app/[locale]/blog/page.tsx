import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getBlogPosts, textOr, type Locale } from '@/content';
import { buildMetadata, buildBreadcrumbJsonLd, calculateReadingTime, SITE_URL } from '@/lib/metadata';
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
    path: '/blog',
    title: isAr ? 'المدونة التقنية والمعرفية | نامي تيك' : 'Engineering & Tech Blog | Nami Tech',
    description: isAr
      ? 'مقالات ودراسات تقنية متخصصة في تطوير البرمجيات وتطبيقات الجوال والمواقع وتجربة المستخدم وأفضل الممارسات.'
      : 'In-depth articles and technical insights on software architecture, mobile apps, web development, and UX design.',
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

  const [posts, tNav, tContent] = await Promise.all([
    getBlogPosts(locale),
    getTranslations({ locale, namespace: 'Nav' }),
    getTranslations({ locale, namespace: 'ContentPages' }),
  ]);
  const isAr = locale === 'ar';

  const breadcrumbs = [
    { label: tNav('home'), href: `/${locale}` },
    { label: tNav('blog') },
  ];

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: tNav('home'), url: `${SITE_URL}/${locale}` },
    { name: tNav('blog'), url: `${SITE_URL}/${locale}/blog` },
  ]);

  return (
    <main id="main" className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Breadcrumb items={breadcrumbs} ariaLabel={tContent('breadcrumbAria')} />

      <header className={styles.header}>
        <div className={styles.badge}>{isAr ? 'مقالات وأبحاث' : 'Articles & Insights'}</div>
        <h1 className={styles.title} data-reveal>{tNav('blog')}</h1>
        <p className={styles.description}>
          {isAr
            ? 'مقالات معرفية ونصائح عملية في مجالات التقنية والبرمجة والتصميم لمساعدتك على اتخاذ أفضل القرارات الرقمية.'
            : 'Insights, architectural guides, and practical engineering tips to help you build better digital products.'}
        </p>
      </header>

      <section aria-label={tNav('blog')} className={styles.section}>
        <div className={styles.grid}>
          {posts.map(post => {
            const postTitle = textOr(post.title, post.slug);
            const postDesc = textOr(post.description);
            const readingTime = calculateReadingTime(post, locale);

            return (
              <article key={post.slug} className={styles.card} data-reveal>
                <div className={styles.metaRow}>
                  <span className={styles.badge}>{tContent('publishedYear')}</span>
                  <span className={styles.metaItem}>⏱ {readingTime.text}</span>
                </div>
                <h2 className={styles.cardTitle}>{postTitle}</h2>
                <p className={styles.cardDesc}>{postDesc}</p>
                <Link href={`/${locale}/blog/${post.slug}`} className={styles.cardLink}>
                  {isAr ? 'قراءة المقال بالكامل ←' : 'Read full article →'}
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
