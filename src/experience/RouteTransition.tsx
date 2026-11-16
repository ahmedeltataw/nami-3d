'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createRouteTransition, type TransitionPhase } from './route-transition';
import { readMotionChoice } from './profile';
import styles from './route-transition.module.css';

export function RouteTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<TransitionPhase>('idle');
  const [machine] = useState(() => createRouteTransition(setPhase));
  const token = useRef(0);
  const destination = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const current = machine;
    const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
    const later = (fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); };
    const instant = () => matchMedia('(prefers-reduced-motion: reduce)').matches || readMotionChoice(localStorage) === 'direct';
    function click(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.('a[href]');
      if (!(link instanceof HTMLAnchorElement) || link.target || link.hasAttribute('download')) return;
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || url.pathname === location.pathname || !/^\/(ar|en)(\/|$)/.test(url.pathname) || instant()) return;
      event.preventDefault();
      clear();
      destination.current = url.pathname;
      const id = token.current = current.start();
      later(() => { if (current.covered(id)) router.push(url.pathname + url.search + url.hash); }, 400);
      later(() => { current.reveal(id); later(() => current.finish(id), 400); }, 2500);
    }
    function pop() {
      clear();
      destination.current = null;
      if (instant()) { current.cancel(); return; }
      const id = token.current = current.start();
      later(() => { current.reveal(id); later(() => current.finish(id), 400); }, 400);
    }
    document.addEventListener('click', click, true);
    window.addEventListener('popstate', pop);
    return () => { clear(); current.cancel(); document.removeEventListener('click', click, true); window.removeEventListener('popstate', pop); };
  }, [router, machine]);
  useEffect(() => {
    const current = machine;
    if (current.phase !== 'switch' || destination.current !== pathname) return;
    const id = token.current;
    current.reveal(id);
    const timer = setTimeout(() => current.finish(id), 400);
    return () => clearTimeout(timer);
  }, [pathname, machine]);
  return <div className={styles.overlay} data-route-transition={phase} aria-hidden="true" />;
}
