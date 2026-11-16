import { readMotionChoice, type MotionChoice } from '../experience/profile';

export interface RevealOptions {
  reducedMotion?: boolean;
  motionChoice?: MotionChoice;
}

export function isReducedMotionEffective(options?: RevealOptions): boolean {
  if (typeof options?.reducedMotion === 'boolean') {
    if (options.reducedMotion) return true;
  } else if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return true;
      }
    } catch {
      /* ignore */
    }
  }

  const choice = options?.motionChoice ?? (typeof window !== 'undefined' ? readMotionChoice(localStorage) : 'cinematic');
  return choice === 'direct';
}

export function initRevealObserver(
  root: { querySelectorAll: (selector: string) => Iterable<Element> } = typeof document !== 'undefined' ? document : { querySelectorAll: () => [] },
  options?: RevealOptions
): () => void {
  const isReduced = isReducedMotionEffective(options);
  const elements = Array.from(root.querySelectorAll('[data-reveal]'));

  if (isReduced) {
    elements.forEach((el) => {
      el.setAttribute('data-revealed', 'true');
    });
    return () => {};
  }

  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
    elements.forEach((el) => {
      el.setAttribute('data-revealed', 'true');
    });
    return () => {};
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.setAttribute('data-revealed', 'true');
          obs.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px',
    }
  );

  elements.forEach((el) => {
    if (el.getAttribute('data-revealed') !== 'true') {
      observer.observe(el);
    }
  });

  return () => {
    observer.disconnect();
  };
}
