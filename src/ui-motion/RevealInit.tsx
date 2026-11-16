'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { MOTION_EVENT } from '../experience/profile';
import { initRevealObserver } from './reveal';

export function RevealInit() {
  const pathname = usePathname();

  useEffect(() => {
    let cleanup = initRevealObserver(document.body);

    function onMotionChange() {
      cleanup();
      cleanup = initRevealObserver(document.body);
    }

    window.addEventListener(MOTION_EVENT, onMotionChange);
    return () => {
      cleanup();
      window.removeEventListener(MOTION_EVENT, onMotionChange);
    };
  }, [pathname]);

  return null;
}
