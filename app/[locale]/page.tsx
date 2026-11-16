import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import { getCompany, getServices, getProjects, getPage, type Locale } from '@/content';
import { SCROLL_BUDGETS } from '@/experience/controller';
import { StationPanel } from '@/experience/scenes/s03/StationPanel';
import { stations } from '@/experience/scenes/s03/station';
import { DnaPanel } from '@/experience/scenes/s06/DnaPanel';
import { collectMilestones } from '@/experience/timemachine/collectMilestones';
import { FuturePanel } from '@/experience/scenes/s07/FuturePanel';
import { buildMetadata } from '@/lib/metadata';
import { GalleryPanel } from '@/experience/scenes/s05/GalleryPanel';
import { galleryProjects } from '@/experience/scenes/s05/projects';
import { Explore } from '@/experience/scenes/s04/Explore';
import { ExperienceControls } from '@/experience/ExperienceControls';
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

  const [t, company, services, projects, milestones] = await Promise.all([
    getTranslations({ locale, namespace: 'Home' }),
    getCompany(locale),
    getServices(locale),
    getProjects(locale),
    collectMilestones(locale),
  ]);

  const fields = new Map<string, string>();
  for (const service of services) {
    if (typeof service.title === 'string') fields.set(`${service.slug}.title`, service.title);
    if (typeof service.description === 'string') fields.set(`${service.slug}.description`, service.description);
  }
  const panels = stations.map(station => {
    const service = services.find(item => item.slug === station.slug);
    if (!service) throw new Error(`Missing service content: ${station.slug}`);
    return { id: station.id, title: fields.get(station.panel.titleKey) ?? '', description: fields.get(station.panel.descKey) ?? '', href: new URL(`/${locale}${station.panel.href}`, service.sourceUrl).href };
  });

  return (
    <main id="main" className={styles.main}>
      {/* S01 — Hero (M2-04 Awakening markup) */}
      <section
        id="s01"
        className={styles.section}
        style={{ '--budget': SCROLL_BUDGETS[0] } as CSSProperties}
      >
        <div className={`${styles.content} ${styles.hero}`}>
          <h1 data-s01-headline>{t('heading')}</h1>
          <p className={styles.subtitle}>{t('subtitle')}</p>
          <ExperienceControls services={services.map(service => typeof service.title === 'string' ? service.title : '').filter(Boolean)} />
          <div className={styles.actions}>
            <a href="#s05">{t('projects')}</a>
            <a href="#s07">{t('contact')}</a>
          </div>
          <p className={styles.scrollHint}>{t('scrollHint')}</p>
          <button
            className={styles.skipIntro}
            type="button"
            data-s01-skip
            aria-label={t('skipIntro')}
          >
            {t('skipIntro')}
          </button>
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
        <StationPanel services={panels} locale={locale} />
      </section>

      {/* S04 — Idea to Reality */}
      <section
        id="s04"
        className={styles.section}
        style={{ '--budget': SCROLL_BUDGETS[3] } as CSSProperties}
      >
        <Explore locale={locale} />
      </section>

      {/* S05 — Projects */}
      <section
        id="s05"
        className={styles.section}
        style={{ '--budget': SCROLL_BUDGETS[4] } as CSSProperties}
      >
        <GalleryPanel projects={galleryProjects(projects)} locale={locale} />
      </section>

      {/* S06 — Vision, Mission & Values (NAMI DNA) */}
      <section
        id="s06"
        className={styles.section}
        style={{ '--budget': SCROLL_BUDGETS[5] } as CSSProperties}
      >
        <DnaPanel
          locale={locale}
          milestones={milestones}
          timeMachineLabels={{ title: t('timeMachine'), close: t('timeMachineClose'), previous: t('timeMachinePrevious'), next: t('timeMachineNext'), slider: t('timeMachineSlider'), article: t('timeMachineArticle'), published: t('timeMachinePublished'), founded: t('timeMachineFounded') }}
          values={company.values.map(val => ({
            id: val.id,
            name: val.name[locale] as string,
            description: typeof val.description[locale] === 'string' ? (val.description[locale] as string) : undefined,
          }))}
          labels={{
            valuesHeading: t('valuesHeading'),
            dnaMessage: t('dnaMessage'),
            aboutSummary: t('aboutSummary'),
            timeMachine: t('timeMachine'),
          }}
        />
      </section>

      {/* S07 — Build Your Future */}
      <section
        id="s07"
        className={styles.section}
        style={{ '--budget': SCROLL_BUDGETS[6] } as CSSProperties}
      >
        <FuturePanel
          locale={locale}
          heading={t('buildFutureHeading')}
          subtitle={t('buildFutureSubtitle')}
          questionHeading={t('buildQuestion')}
          options={[
            { id: 'website', label: t('typeWeb') },
            { id: 'mobile', label: t('typeMobile') },
            { id: 'marketing', label: t('typeMarketing') },
            { id: 'other', label: t('typeOther') },
          ]}
          contactCta={t('contact')}
        />
      </section>
    </main>
  );
}
