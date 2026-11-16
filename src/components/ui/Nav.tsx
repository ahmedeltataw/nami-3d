'use client';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { SCENE_IDS } from '@/experience/controller';
import { useExperienceStore } from '@/experience/store';
import { LocaleSwitch } from './LocaleSwitch';
import { MotionSwitch } from './MotionSwitch';
import styles from './Nav.module.css';

export function Nav() {
  const locale = useLocale();
  const t = useTranslations('Nav');
  const scene = useExperienceStore(state => state.scene);
  const [isOpen, setIsOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!isOpen || !panel.current || !toggle.current) return;
    const origin = toggle.current.getBoundingClientRect();
    const links = panel.current.querySelectorAll<HTMLElement>('a');
    links.forEach(link => { link.style.animation = 'none'; });
    links.forEach(link => {
      const rect = link.getBoundingClientRect();
      link.style.setProperty('--burst-x', `${origin.left + origin.width / 2 - rect.left - rect.width / 2}px`);
      link.style.setProperty('--burst-y', `${origin.top + origin.height / 2 - rect.top - rect.height / 2}px`);
    });
    links.forEach(link => { link.style.animation = ''; });
  }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLElement>('a, button')?.focus();
    function key(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); setIsOpen(false); toggle.current?.focus(); return; }
      if (event.key !== 'Tab') return;
      const items = [toggle.current, ...Array.from(panel.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [])].filter((item): item is HTMLElement => !!item);
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && index <= 0) { event.preventDefault(); items[items.length - 1]?.focus(); }
      else if (!event.shiftKey && (index === items.length - 1 || index < 0)) { event.preventDefault(); items[0]?.focus(); }
    }
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('keydown', key); };
  }, [isOpen]);
  const pages = ['home', 'services', 'projects', 'about', 'blog', 'contact', 'careers', 'faqs'] as const;
  return <header className={styles.header}>
    <nav className={styles.navContainer} aria-label={t('home')}>
      <Link href={`/${locale}`} className={styles.logoLink} onClick={() => setIsOpen(false)}><Image src="/brand/logo.svg" alt="Nami" width={105} height={36} className={styles.logo} unoptimized /></Link>
      <div className={styles.headerScenes} aria-label={t('scenesAriaLabel')}>
        {SCENE_IDS.map(id => <a key={id} href={`/${locale}#${id}`} aria-current={scene === id ? 'location' : undefined}>{id}</a>)}
      </div>
      <div className={styles.controlsGroup}><LocaleSwitch /><button ref={toggle} type="button" className={styles.menuButton} aria-expanded={isOpen} aria-controls="mobile-nav-panel" aria-label={isOpen ? t('closeMenu') : t('openMenu')} onClick={() => setIsOpen(!isOpen)} data-magnetic>{isOpen ? '×' : '☰'}</button></div>
    </nav>
    <div id="mobile-nav-panel" ref={panel} className={styles.overlay} hidden={!isOpen}>
      <div className={styles.content}>
        <div className={styles.sceneList} aria-label={t('scenesAriaLabel')}>
          {SCENE_IDS.map((id, index) => <a key={id} href={`/${locale}#${id}`} aria-current={scene === id ? 'location' : undefined} onClick={() => setIsOpen(false)} style={{ '--i': index } as CSSProperties}>{id.toUpperCase()}</a>)}
        </div>
        <div className={styles.pageList}>{pages.map((page, index) => <Link key={page} href={page === 'home' ? `/${locale}` : `/${locale}/${page}`} onClick={() => setIsOpen(false)} style={{ '--i': index } as CSSProperties}>{t(page)}</Link>)}</div>
        <MotionSwitch />
      </div>
    </div>
  </header>;
}
