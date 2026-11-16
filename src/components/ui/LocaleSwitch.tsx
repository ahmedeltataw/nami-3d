'use client';

import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { useLocale } from 'next-intl';
import { switchLocalePath } from '@/lib/locale-path';
import styles from './LocaleSwitch.module.css';

function subscribeHash(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

function getHashSnapshot() {
  return window.location.hash;
}

function getHashServerSnapshot() {
  return '';
}

export function LocaleSwitch() {
  const currentLocale = useLocale();
  const pathname = usePathname() || `/${currentLocale}`;
  const targetLocale = currentLocale === 'ar' ? 'en' : 'ar';
  const hash = useSyncExternalStore(subscribeHash, getHashSnapshot, getHashServerSnapshot);

  const targetHref = switchLocalePath(pathname, currentLocale, targetLocale, hash);
  const label = targetLocale === 'ar' ? 'العربية' : 'English';
  const ariaLabel = currentLocale === 'ar' ? 'Switch to English' : 'التبديل إلى العربية';

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (typeof window !== 'undefined') {
      const currentHash = window.location.hash;
      if (currentHash && currentHash !== hash) {
        e.currentTarget.href = switchLocalePath(pathname, currentLocale, targetLocale, currentHash);
      }
    }
  };

  return (
    <a
      href={targetHref}
      className={styles.switch}
      lang={targetLocale}
      hrefLang={targetLocale}
      aria-label={ariaLabel}
      onClick={handleClick}
    >
      <span className={styles.label}>{label}</span>
      <span className={styles.badge}>{targetLocale.toUpperCase()}</span>
    </a>
  );
}
