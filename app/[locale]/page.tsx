import type { Metadata } from 'next';
import Link from 'next/link';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import { getCompany, getServices, getProjects, getPage, textOr, type Locale } from '@/content';
import { SCROLL_BUDGETS } from '@/experience/controller';
import { SkipIntro } from '@/components/ui/SkipIntro';
import { buildMetadata } from '@/lib/metadata';
import styles from './page.module.css';
import type { CSSProperties } from 'react';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const page = await getPage('home', locale as Locale);
  return buildMetadata({
    locale: locale as Locale,
    path: '',
    title: typeof page?.title === 'string' ? page.title : 'Nami Tech',
    description: typeof page?.description === 'string' ? page.description : 'Nami Tech 3D experience',
  });
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!hasLocale(routing.locales, rawLocale)) notFound();
  const locale = rawLocale as Locale;
  setRequestLocale(locale);

  const [t, homePage, company, services, projects] = await Promise.all([
    getTranslations({ locale, namespace: 'Home' }),
    getPage('home', locale),
    getCompany(locale),
    getServices(locale),
    getProjects(locale),
  ]);

  const heroHeadline = typeof homePage?.headings?.[0]?.text === 'string' ? homePage.headings[0].text : t('heading');
  const heroSubtitle = typeof homePage?.paragraphs?.[0] === 'string' ? homePage.paragraphs[0] : t('subtitle');

  return (
    <main id="main" className={styles.main}>
      {/* S01 — Hero */}
      <section
        id="s01"
        className={styles.section}
        style={{ '--budget': SCROLL_BUDGETS[0] } as CSSProperties}
      >
        <div className={`${styles.content} ${styles.heroContent}`}>
          <h1 className={styles.heroTitle}>{heroHeadline}</h1>
          <p className={styles.heroSubtitle}>{heroSubtitle}</p>
          <div className={styles.heroCtas}>
            <Link href={`/${locale}/contact`} className={styles.primaryBtn}>
              {t('startProject')}
            </Link>
            <Link href={`/${locale}#s03`} className={styles.secondaryBtn}>
              {t('ourServices')}
            </Link>
            <SkipIntro label={t('skipIntro')} />
          </div>
        </div>
      </section>

      {/* S02 — Transition */}
      <section
        id="s02"
        className={styles.section}
        style={{ '--budget': SCROLL_BUDGETS[1] } as CSSProperties}
      >
        <div className={styles.content}>
          <h2 className={styles.sectionTitle}>{t('transitionTitle')}</h2>
          <p className={styles.lead}>{t('transitionText')}</p>
        </div>
      </section>

      {/* S03 — Services */}
      <section
        id="s03"
        className={styles.section}
        style={{ '--budget': SCROLL_BUDGETS[2] } as CSSProperties}
      >
        <div className={styles.content}>
          <h2 className={styles.sectionTitle}>{t('servicesHeading')}</h2>
          <p className={styles.sectionSubtitle}>{t('servicesSubheading')}</p>
          <div className={styles.servicesGrid}>
            {services.slice(0, 6).map(service => {
              const serviceTitle = textOr(service.title);
              const serviceDesc = textOr(service.description);
              return (
                <article key={service.slug} className={styles.serviceCard}>
                  <h3 className={styles.serviceTitle}>{serviceTitle}</h3>
                  <p className={styles.serviceDesc}>{serviceDesc}</p>
                  <Link href={`/${locale}/services/${service.slug}`} className={styles.cardLink}>
                    {serviceTitle} →
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* S04 — Idea to Reality */}
      <section
        id="s04"
        className={styles.section}
        style={{ '--budget': SCROLL_BUDGETS[3] } as CSSProperties}
      >
        <div className={styles.content}>
          <h2 className={styles.sectionTitle}>{t('ideaRealityHeading')}</h2>
          <p className={styles.lead}>{t('ideaRealityText')}</p>
        </div>
      </section>

      {/* S05 — Projects */}
      <section
        id="s05"
        className={styles.section}
        style={{ '--budget': SCROLL_BUDGETS[4] } as CSSProperties}
      >
        <div className={styles.content}>
          <h2 className={styles.sectionTitle}>{t('projectsHeading')}</h2>
          <p className={styles.sectionSubtitle}>{t('projectsSubheading')}</p>
          <div className={styles.projectsGrid}>
            {projects.slice(0, 6).map(project => {
              const h1Text = project.headings?.find(h => h.level === 'h1')?.text;
              const name: string = typeof h1Text === 'string'
                ? h1Text
                : (typeof project.title === 'string' ? project.title.replace(/\s*\|\s*.*$/, '') : project.slug);
              const category = typeof project.category === 'string' ? project.category : null;
              return (
                <article key={project.slug} className={styles.projectCard}>
                  <h3 className={styles.projectTitle}>{name}</h3>
                  {category && <span className={styles.categoryBadge}>{category}</span>}
                  <p className={styles.projectDesc}>{textOr(project.description)}</p>
                  <Link href={`/${locale}/projects/${project.slug}`} className={styles.cardLink}>
                    {t('viewProject')} →
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* S06 — Vision, Mission & Values */}
      <section
        id="s06"
        className={styles.section}
        style={{ '--budget': SCROLL_BUDGETS[5] } as CSSProperties}
      >
        <div className={styles.content}>
          <div className={styles.visionMissionGrid}>
            <div className={styles.vmCard}>
              <h2 className={styles.sectionTitle}>{t('visionHeading')}</h2>
              <p className={styles.lead}>{company.vision[locale] as string}</p>
            </div>
            <div className={styles.vmCard}>
              <h2 className={styles.sectionTitle}>{t('missionHeading')}</h2>
              <p className={styles.lead}>{company.mission[locale] as string}</p>
            </div>
          </div>
          <div className={styles.valuesBlock}>
            <h3 className={styles.valuesTitle}>{t('valuesHeading')}</h3>
            <ul className={styles.valuesList}>
              {company.values.map(val => (
                <li key={val.id} className={styles.valueItem}>
                  <span className={styles.valueName}>{val.name[locale] as string}</span>
                  {typeof val.description[locale] === 'string' && (
                    <p className={styles.valueDesc}>{val.description[locale] as string}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* S07 — Build Your Future */}
      <section
        id="s07"
        className={styles.section}
        style={{ '--budget': SCROLL_BUDGETS[6] } as CSSProperties}
      >
        <div className={styles.content}>
          <h2 className={styles.sectionTitle}>{t('buildFutureHeading')}</h2>
          <p className={styles.lead}>{t('buildFutureSubtitle')}</p>
          <div className={styles.projectChoicesGrid}>
            <Link href={`/${locale}/contact?type=web`} className={styles.choiceCard}>
              <span className={styles.choiceTitle}>{t('typeWeb')}</span>
              <span className={styles.choiceArrow}>→</span>
            </Link>
            <Link href={`/${locale}/contact?type=mobile`} className={styles.choiceCard}>
              <span className={styles.choiceTitle}>{t('typeMobile')}</span>
              <span className={styles.choiceArrow}>→</span>
            </Link>
            <Link href={`/${locale}/contact?type=marketing`} className={styles.choiceCard}>
              <span className={styles.choiceTitle}>{t('typeMarketing')}</span>
              <span className={styles.choiceArrow}>→</span>
            </Link>
            <Link href={`/${locale}/contact?type=other`} className={styles.choiceCard}>
              <span className={styles.choiceTitle}>{t('typeOther')}</span>
              <span className={styles.choiceArrow}>→</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
