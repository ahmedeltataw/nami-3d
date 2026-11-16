'use client';

import { useExperienceStore } from '../../store';
import styles from './panel.module.css';

export type DnaValue = {
  id: string;
  name: string;
  description?: string;
};

export type DnaPanelProps = {
  locale: string;
  values: DnaValue[];
  labels: {
    valuesHeading: string;
    dnaMessage: string;
    aboutSummary: string;
    timeMachine: string;
  };
};

export function DnaPanel({ locale, values, labels }: DnaPanelProps) {
  const activeIndex = useExperienceStore(state => state.dnaValueIndex);
  const activeValue = values[activeIndex] ?? values[0];
  const activeValueName = activeValue?.name ?? '';

  function handleTimeMachine() {
    window.dispatchEvent(new CustomEvent('nami:time-machine'));
  }

  const ariaTimeMachineLabel = locale === 'ar'
    ? 'الانتقال إلى آلة الزمن لتاريخ نامي'
    : 'Launch Time Machine to explore Nami history';

  return (
    <div className={styles.panel}>
      <header className={styles.header}>
        <h2 className={styles.title}>{labels.valuesHeading}</h2>
      </header>

      {/* Screen reader aria-live announcement for value changes */}
      <div className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {activeValueName ? `${activeValueName} (${activeIndex + 1} / ${values.length})` : ''}
      </div>

      {/* Static HTML ordered list of all 7 values */}
      <ol
        className={styles.valuesList}
        aria-label={labels.valuesHeading}
      >
        {values.map((val, index) => {
          const isCurrent = index === activeIndex;
          const hasDesc = typeof val.description === 'string' && val.description.trim().length > 0;

          return (
            <li
              key={val.id}
              className={`${styles.valueItem} ${isCurrent ? styles.activeValue : ''}`}
              aria-current={isCurrent ? 'true' : undefined}
            >
              <div className={styles.valueHeader}>
                <span className={styles.valueNumber} aria-hidden="true">{index + 1}</span>
                <span className={styles.valueName}>{val.name}</span>
              </div>
              {hasDesc && <p className={styles.valueDesc}>{val.description}</p>}
            </li>
          );
        })}
      </ol>

      {/* Message line + about summary + Time Machine entry button */}
      <section
        className={styles.aboutSection}
        aria-label={locale === 'ar' ? 'عن نامي' : 'About Nami'}
      >
        <p className={styles.messageLine}>{labels.dnaMessage}</p>
        <p className={styles.aboutSummary}>{labels.aboutSummary}</p>
        <button
          type="button"
          className={styles.timeMachineBtn}
          aria-label={ariaTimeMachineLabel}
          onClick={handleTimeMachine}
        >
          {labels.timeMachine}
        </button>
      </section>
    </div>
  );
}
