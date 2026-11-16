import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getBlogPosts, getBlogPost, textOr, type Locale } from '@/content';
import { buildMetadata, buildArticleJsonLd, buildBreadcrumbJsonLd, calculateReadingTime, SITE_URL } from '@/lib/metadata';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
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

  const [post, allPosts, tNav, tContent] = await Promise.all([
    getBlogPost(slug, locale),
    getBlogPosts(locale),
    getTranslations({ locale, namespace: 'Nav' }),
    getTranslations({ locale, namespace: 'ContentPages' }),
  ]);
  if (!post) notFound();

  const isAr = locale === 'ar';
  const title = textOr(post.title, slug);
  const description = textOr(post.description);
  const readingTime = calculateReadingTime(post, locale);

  const currentIndex = allPosts.findIndex(p => p.slug === slug);
  const prevPost = currentIndex > 0 ? allPosts[currentIndex - 1] : null;
  const nextPost = currentIndex >= 0 && currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null;

  const articleUrl = `${SITE_URL}/${locale}/blog/${slug}`;
  const articleJsonLd = buildArticleJsonLd({
    headline: title,
    description: description || title,
    url: articleUrl,
    locale,
    datePublished: '2026-01-01',
  });

  const breadcrumbs = [
    { label: tNav('home'), href: `/${locale}` },
    { label: tNav('blog'), href: `/${locale}/blog` },
    { label: title },
  ];

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: tNav('home'), url: `${SITE_URL}/${locale}` },
    { name: tNav('blog'), url: `${SITE_URL}/${locale}/blog` },
    { name: title, url: articleUrl },
  ]);

  // Subheadings for Table of Contents and structured body
  const subHeadings = post.headings
    .filter(h => typeof h.text === 'string' && h.text.trim() !== title.trim())
    .map(h => ({ level: h.level, text: h.text as string }));

  // Distribute paragraphs among subheadings so real headings are paired with real body text
  const totalParagraphs = post.paragraphs.filter((p): p is string => typeof p === 'string');
  const paragraphsPerHeading = subHeadings.length > 0
    ? Math.max(1, Math.floor(totalParagraphs.length / subHeadings.length))
    : totalParagraphs.length;

  return (
    <main id="main" className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Breadcrumb items={breadcrumbs} ariaLabel={tContent('breadcrumbAria')} />

      <article>
        <header className={styles.header}>
          <div className={styles.badge}>{isAr ? 'مقال تقني' : 'Technical Article'}</div>
          <h1 className={styles.title}>{title}</h1>
          <div className={styles.metaRow}>
            <span className={styles.metaItem}>📅 {tContent('publishedYear')}</span>
            <span className={styles.metaItem}>⏱ {readingTime.text}</span>
            <span className={styles.metaItem}>✍️ {tContent('author')}</span>
          </div>
          {description && <p className={styles.description} style={{ marginBlockStart: 'var(--space-3)' }}>{description}</p>}
        </header>

        {/* Table of Contents */}
        {subHeadings.length > 0 && (
          <nav aria-label={tContent('tableOfContents')} className={styles.tocCard}>
            <h2 className={styles.tocTitle}>{tContent('tableOfContents')}</h2>
            <ol className={styles.tocList}>
              {subHeadings.map((h, idx) => (
                <li key={idx}>
                  <a href={`#heading-${idx}`} className={styles.tocLink}>
                    {h.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* Real body with headings and paragraphs */}
        {subHeadings.length > 0 ? (
          subHeadings.map((heading, hIdx) => {
            const start = hIdx * paragraphsPerHeading;
            const end = hIdx === subHeadings.length - 1 ? totalParagraphs.length : start + paragraphsPerHeading;
            const sectionParagraphs = totalParagraphs.slice(start, end);

            return (
              <section key={hIdx} className={styles.section} aria-labelledby={`heading-${hIdx}`}>
                <h2 id={`heading-${hIdx}`} className={styles.sectionTitle}>
                  {heading.text}
                </h2>
                {sectionParagraphs.map((p, pIdx) => (
                  <p key={pIdx} className={styles.paragraph}>
                    {p}
                  </p>
                ))}
              </section>
            );
          })
        ) : (
          <section className={styles.section}>
            {totalParagraphs.map((p, pIdx) => (
              <p key={pIdx} className={styles.paragraph}>
                {p}
              </p>
            ))}
          </section>
        )}

        {/* Render lists if present */}
        {post.lists.map((list, listIdx) => (
          <section key={listIdx} className={styles.section} aria-label={isAr ? 'نقاط إضافية' : 'Key Points'}>
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

        {/* Prev / Next Navigation */}
        {(prevPost || nextPost) && (
          <nav aria-label={isAr ? 'تنقل بين المقالات' : 'Article navigation'} className={styles.prevNextNav}>
            {prevPost ? (
              <Link href={`/${locale}/blog/${prevPost.slug}`} className={styles.prevNextCard}>
                <span className={styles.prevNextLabel}>← {tContent('prevArticle')}</span>
                <span className={styles.prevNextTitle}>{textOr(prevPost.title, prevPost.slug)}</span>
              </Link>
            ) : <div />}
            {nextPost ? (
              <Link href={`/${locale}/blog/${nextPost.slug}`} className={styles.prevNextCard} style={{ textAlign: isAr ? 'left' : 'right' }}>
                <span className={styles.prevNextLabel}>{tContent('nextArticle')} →</span>
                <span className={styles.prevNextTitle}>{textOr(nextPost.title, nextPost.slug)}</span>
              </Link>
            ) : <div />}
          </nav>
        )}
      </article>

      <section className={styles.ctaSection} aria-label={tContent('ctaContactTitle')}>
        <h2 className={styles.ctaTitle}>{tContent('ctaContactTitle')}</h2>
        <p className={styles.ctaDesc}>{tContent('ctaContactText')}</p>
        <Link href={`/${locale}/contact`} className={styles.ctaButton}>
          {tContent('ctaContactButton')}
        </Link>
      </section>

      <footer className={styles.header}>
        <Link href={`/${locale}/blog`} className={styles.backLink}>
          {tContent('backToBlog')}
        </Link>
      </footer>
    </main>
  );
}
