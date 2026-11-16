'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { SCENE_IDS } from '@/experience/controller';
import { LocaleSwitch } from './LocaleSwitch';
import styles from './Nav.module.css';

export function Nav() {
  const locale = useLocale();
  const t = useTranslations('Nav');
  const [isOpen, setIsOpen] = useState(false);
  const toggleBtnRef = useRef<HTMLButtonElement>(null);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        toggleBtnRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const closeMenu = () => setIsOpen(false);

  return (
    <header className={styles.header}>
      <nav className={styles.navContainer} aria-label={t('home')}>
        <div className={styles.brandGroup}>
          <Link href={`/${locale}`} className={styles.logoLink} onClick={closeMenu}>
            <Image
              src="/brand/logo.svg"
              alt="Nami"
              width={105}
              height={36}
              className={styles.logo}
              unoptimized
            />
          </Link>

          <div className={styles.scenesNav} aria-label={t('scenesAriaLabel')}>
            {SCENE_IDS.map(id => (
              <a key={id} href={`#${id}`} className={styles.sceneLink} onClick={closeMenu}>
                {id}
              </a>
            ))}
          </div>
        </div>

        <div className={styles.desktopNav}>
          <Link href={`/${locale}/services`} className={styles.pageLink}>
            {t('services')}
          </Link>
          <Link href={`/${locale}/projects`} className={styles.pageLink}>
            {t('projects')}
          </Link>
          <Link href={`/${locale}/about`} className={styles.pageLink}>
            {t('about')}
          </Link>
          <Link href={`/${locale}/blog`} className={styles.pageLink}>
            {t('blog')}
          </Link>
          <Link href={`/${locale}/contact`} className={styles.pageLink}>
            {t('contact')}
          </Link>
        </div>

        <div className={styles.controlsGroup}>
          <LocaleSwitch />

          <button
            ref={toggleBtnRef}
            type="button"
            className={styles.menuButton}
            aria-expanded={isOpen}
            aria-controls="mobile-nav-panel"
            aria-label={isOpen ? t('closeMenu') : t('openMenu')}
            onClick={() => setIsOpen(!isOpen)}
          >
            <span className={styles.menuIcon} aria-hidden="true">
              <span className={`${styles.menuBar} ${isOpen ? styles.menuBarOpen1 : ''}`} />
              <span className={`${styles.menuBar} ${isOpen ? styles.menuBarOpen2 : ''}`} />
              <span className={`${styles.menuBar} ${isOpen ? styles.menuBarOpen3 : ''}`} />
            </span>
          </button>
        </div>
      </nav>

      <div
        id="mobile-nav-panel"
        className={`${styles.mobileDrawer} ${isOpen ? '' : styles.mobileDrawerHidden}`}
        aria-hidden={!isOpen}
      >
        <div className={styles.mobilePageList}>
          <Link href={`/${locale}`} className={styles.mobilePageLink} onClick={closeMenu}>
            {t('home')}
          </Link>
          <Link href={`/${locale}/services`} className={styles.mobilePageLink} onClick={closeMenu}>
            {t('services')}
          </Link>
          <Link href={`/${locale}/projects`} className={styles.mobilePageLink} onClick={closeMenu}>
            {t('projects')}
          </Link>
          <Link href={`/${locale}/about`} className={styles.mobilePageLink} onClick={closeMenu}>
            {t('about')}
          </Link>
          <Link href={`/${locale}/blog`} className={styles.mobilePageLink} onClick={closeMenu}>
            {t('blog')}
          </Link>
          <Link href={`/${locale}/contact`} className={styles.mobilePageLink} onClick={closeMenu}>
            {t('contact')}
          </Link>
          <Link href={`/${locale}/careers`} className={styles.mobilePageLink} onClick={closeMenu}>
            {t('careers')}
          </Link>
          <Link href={`/${locale}/faqs`} className={styles.mobilePageLink} onClick={closeMenu}>
            {t('faqs')}
          </Link>
        </div>
      </div>
    </header>
  );
}
