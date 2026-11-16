import { SCENE_IDS } from '../controller';
import { referenceToolsEnabled } from './gate';

export function referenceOverlay(): () => void {
  if (typeof window === 'undefined') return () => {};
  if (!referenceToolsEnabled(process.env.NODE_ENV, process.env.NEXT_PUBLIC_DEBUG_TOOLS)) return () => {};
  const params = new URLSearchParams(window.location.search);
  if (params.get('debug') !== 'reference') return () => {};
  const scene = params.get('scene')?.toLowerCase();
  if (!SCENE_IDS.some(id => id === scene)) return () => {};
  const requested = Number(params.get('opacity') ?? '0.5');
  let opacity = Number.isFinite(requested) ? Math.max(0, Math.min(1, requested)) : 0.5;
  const image = document.createElement('img');
  image.src = `/_refs/${scene!.toUpperCase()}.png`;
  image.onerror = () => {
    if (image.src.endsWith(`${scene!.toUpperCase()}.png`)) {
      image.src = `/_refs/${scene!.toLowerCase()}.png`;
    }
  };
  image.alt = '';
  image.setAttribute('aria-hidden', 'true');
  image.dataset.referenceOverlay = scene!;
  Object.assign(image.style, {
    position: 'fixed', inset: '0', width: '100vw', height: '100vh',
    objectFit: 'fill', pointerEvents: 'none', zIndex: '2147483647', opacity: String(opacity),
  });
  document.body.append(image);
  function keydown(event: KeyboardEvent) {
    if (typeof Element !== 'undefined' && event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable]')) return;
    if (event.key !== '[' && event.key !== ']') return;
    opacity = Math.max(0, Math.min(1, Math.round((opacity + (event.key === ']' ? 0.05 : -0.05)) * 100) / 100));
    image.style.opacity = String(opacity);
  }
  window.addEventListener('keydown', keydown);
  return () => { image.remove(); window.removeEventListener('keydown', keydown); };
}
