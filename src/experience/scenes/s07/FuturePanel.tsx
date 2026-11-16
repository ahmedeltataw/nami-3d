'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useExperienceStore } from '../../store';
import styles from './panel.module.css';

export type BuildFutureOption = {
  id: 'website' | 'mobile' | 'marketing' | 'other';
  label: string;
};

export type FuturePanelProps = {
  locale: string;
  heading: string;
  subtitle: string;
  questionHeading: string;
  options: BuildFutureOption[];
  contactCta: string;
};

export function FuturePanel({
  locale,
  heading,
  subtitle,
  questionHeading,
  options,
  contactCta,
}: FuturePanelProps) {
  const projectType = useExperienceStore(state => state.projectType);
  const setProjectType = useExperienceStore(state => state.setProjectType);

  // Synchronize data-project-type attribute on #s07 section container
  useEffect(() => {
    const section = document.getElementById('s07');
    if (section) {
      if (projectType) {
        section.setAttribute('data-project-type', projectType);
      } else {
        section.removeAttribute('data-project-type');
      }
    }
  }, [projectType]);

  function handleSelect(id: 'website' | 'mobile' | 'marketing' | 'other') {
    setProjectType(id);
    // Dispatch custom events to trigger 3D core dissolve/assemble and robot gesture
    window.dispatchEvent(
      new CustomEvent('nami:s07-choice', {
        detail: id,
      })
    );
    window.dispatchEvent(
      new CustomEvent('nami:robot-react', {
        detail: { name: 'React', duration: 0.9 },
      })
    );
  }

  const selectedOption = options.find(opt => opt.id === projectType);

  return (
    <div className={styles.panel} lang={locale}>
      <div className={styles.headingGroup}>
        <h2 className={styles.title}>{heading}</h2>
        <p className={styles.subtitle}>{subtitle}</p>
        <p className={styles.question} id="s07-question">{questionHeading}</p>
      </div>

      {/* Screen reader announcement for choice changes */}
      <div className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {selectedOption
          ? locale === 'ar'
            ? `تم اختيار ${selectedOption.label}`
            : `Selected ${selectedOption.label}`
          : ''}
      </div>

      {/* 4 option buttons */}
      <div
        className={styles.optionsGrid}
        role="group"
        aria-labelledby="s07-question"
      >
        {options.map((opt) => {
          const isSelected = projectType === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              className={`${styles.optionButton} ${isSelected ? styles.selected : ''}`}
              aria-pressed={isSelected}
              data-choice={opt.id}
              onClick={() => handleSelect(opt.id)}
            >
              <span className={styles.optionNumber} aria-hidden="true">
                {opt.id === 'website' && '01'}
                {opt.id === 'mobile' && '02'}
                {opt.id === 'marketing' && '03'}
                {opt.id === 'other' && '04'}
              </span>
              <span className={styles.optionLabel}>{opt.label}</span>
              <span className={styles.optionCheck} aria-hidden="true">
                {isSelected ? '✓' : '→'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Link to Contact Form with selected project type preserved */}
      <div className={styles.ctaContainer}>
        <Link
          href={`/${locale}/contact?type=${projectType ?? 'web'}`}
          className={styles.ctaButton}
        >
          <span>{contactCta}</span>
          <span aria-hidden="true">{locale === 'ar' ? '←' : '→'}</span>
        </Link>
      </div>
    </div>
  );
}

export const BuildFuturePanel = FuturePanel;
