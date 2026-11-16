import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getFaqs, type Locale } from '@/content';
import { buildMetadata, buildFaqJsonLd, buildBreadcrumbJsonLd, SITE_URL } from '@/lib/metadata';
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
  const faqs = await getFaqs(locale as Locale);
  const first = faqs[0];
  const title = isAr ? 'الأسئلة الشائعة | نامي تيك' : 'Frequently Asked Questions | Nami Tech';
  const description = typeof first?.description === 'string'
    ? first.description
    : (isAr
      ? 'إجابات على أكثر الأسئلة شيوعاً حول خدمات نامي تيك ومراحل العمل والأسعار والدعم الفني.'
      : 'Answers to frequently asked questions about Nami Tech services, workflows, pricing, and support.');

  return buildMetadata({
    locale: locale as Locale,
    path: '/faqs',
    title,
    description,
  });
}

export default async function FaqsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!hasLocale(routing.locales, rawLocale)) notFound();
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  const [faqs, tNav, tContent] = await Promise.all([
    getFaqs(locale),
    getTranslations({ locale, namespace: 'Nav' }),
    getTranslations({ locale, namespace: 'ContentPages' }),
  ]);
  const isAr = locale === 'ar';
  const first = faqs[0];

  const mainH1 = first?.headings?.find(h => h.level === 'h1')?.text;
  const pageTitle = typeof mainH1 === 'string' ? mainH1 : (isAr ? 'الأسئلة الشائعة' : 'Frequently Asked Questions');
  const introH6 = first?.headings?.find(h => h.level === 'h6')?.text;
  const introText = typeof introH6 === 'string'
    ? introH6
    : (typeof first?.description === 'string' ? first.description : tContent('faqSubtitle'));

  // Core FAQ items based on content & company services
  const faqItems = isAr
    ? [
        {
          question: 'ما هي الخدمات التي تقدمها شركة نامي؟',
          answer:
            'نقدم في شركة نامي حلولاً برمجية ورقمية متكاملة تشمل: تطوير مواقع الويب الحديثة، وتطبيقات الهواتف الذكية (iOS و Android)، والتسويق الرقمي وإدارة الحملات، والاستشارات التقنية، والخدمات السحابية، وخدمات التصميم وهوية العلامة التجارية.',
        },
        {
          question: 'كيف تبدأ مشروعك البرمجي مع نامي؟',
          answer:
            'يبدأ مشروعك بمحادثة تفصيلية وجلسة استشارية لفهم أهدافك، تليها مرحلة التخطيط وتصميم النماذج الأولية وتحديد الجدول الزمني والميزانية، ثم الانتقال لمرحلة التطوير والاختبار والإطلاق الرسمي.',
        },
        {
          question: 'ما هي المعايير التقنية التي تتبعها نامي في بناء المنتجات؟',
          answer:
            'نعتمد أحدث معايير الأمان وقابلية التوسع والأداء العالي، ونضمن تجربة مستخدم سلسة واستجابة كاملة لجميع الشاشات مع اختبارات جودة مستمرة قبل التسليم.',
        },
        {
          question: 'هل تقدم نامي خدمات الدعم الفني بعد إطلاق المشروع؟',
          answer:
            'نعم، نوفر باقات دعم فني وصيانة دورية ومراقبة أداء مستمرة لضمان استقرار وتطور منصتك الرقمية ومواكبة نمو أعمالك.',
        },
        {
          question: 'كيف يمكنني التواصل مع فريق العمل لطلب عرض سعر؟',
          answer:
            'يمكنك التواصل معنا عبر نموذج "تواصل معنا" أو البريد الإلكتروني info@nami-tec.com أو الاتصال المباشر بمكاتبنا في المملكة العربية السعودية ومصر.',
        },
      ]
    : [
        {
          question: 'What services does Nami provide?',
          answer:
            'At Nami, we provide full-spectrum digital and software solutions including: modern website development, iOS and Android mobile applications, digital marketing and growth campaigns, technical consulting, cloud services, and brand identity design.',
        },
        {
          question: 'How do I start a project with Nami?',
          answer:
            'Every project begins with a discovery consultation to understand your business objectives, followed by architectural planning, UI/UX prototyping, agile development, rigorous QA testing, and seamless deployment.',
        },
        {
          question: 'What technical standards does Nami follow?',
          answer:
            'We engineer for high availability, security, scalability, and peak Core Web Vitals performance across all modern devices and platforms.',
        },
        {
          question: 'Does Nami offer post-launch technical support?',
          answer:
            'Yes, we provide ongoing maintenance packages, system monitoring, and continuous product enhancement to support your long-term digital growth.',
        },
        {
          question: 'How can I contact the team for a quote or inquiry?',
          answer:
            'You can reach us through our Contact Us form, email us at info@nami-tec.com, or connect via WhatsApp and direct lines at our Saudi Arabia and Egypt offices.',
        },
      ];

  const faqJsonLd = buildFaqJsonLd(faqItems);
  const breadcrumbs = [
    { label: tNav('home'), href: `/${locale}` },
    { label: tNav('faqs') },
  ];

  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: tNav('home'), url: `${SITE_URL}/${locale}` },
    { name: tNav('faqs'), url: `${SITE_URL}/${locale}/faqs` },
  ]);

  return (
    <main id="main" className={styles.page}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Breadcrumb items={breadcrumbs} ariaLabel={tContent('breadcrumbAria')} />

      <header className={styles.header}>
        <div className={styles.badge}>{tContent('faqBadge')}</div>
        <h1 className={styles.title}>{pageTitle}</h1>
        <p className={styles.description}>{introText}</p>
      </header>

      <section aria-label={tNav('faqs')} className={styles.section}>
        <div className={styles.detailsList}>
          {faqItems.map((item, idx) => (
            <details key={idx} className={styles.details} id={`faq-${idx}`}>
              <summary className={styles.summary} tabIndex={0}>
                <span>{item.question}</span>
                <span className={styles.detailsIndicator} aria-hidden="true">
                  +
                </span>
              </summary>
              <div className={styles.detailsContent}>
                <p>{item.answer}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className={styles.ctaSection} aria-label={tContent('ctaContactTitle')}>
        <h2 className={styles.ctaTitle}>{tContent('ctaContactTitle')}</h2>
        <p className={styles.ctaDesc}>{tContent('ctaContactText')}</p>
        <Link href={`/${locale}/contact`} className={styles.ctaButton}>
          {tContent('ctaContactButton')}
        </Link>
      </section>
    </main>
  );
}
