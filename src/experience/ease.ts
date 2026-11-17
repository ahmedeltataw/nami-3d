import { gsap } from 'gsap';

const curves = new Map<string, (p: number) => number>();
export function ease(name: string, progress: number) {
  let curve = curves.get(name);
  if (!curve) { curve = gsap.parseEase(name); curves.set(name, curve); }
  return curve(Math.max(0, Math.min(1, progress)));
}
