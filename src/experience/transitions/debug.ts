import type { ExperienceRuntime } from '../runtime';

export function transitionDebug(runtime: ExperienceRuntime) {
  const overlay = document.createElement('output');
  overlay.dataset.transitionDebug = '';
  Object.assign(overlay.style, { position: 'fixed', bottom: '12px', left: '12px', zIndex: '9999', padding: '8px', background: '#111', color: '#fff', pointerEvents: 'none' });
  document.body.append(overlay);
  let frame = 0;
  const update = () => {
    const transition = runtime.transition;
    overlay.textContent = transition ? `${transition.id} ${(transition.progress * 100).toFixed(1)}%` : 'No active transition';
    frame = requestAnimationFrame(update);
  };
  update();
  return () => { cancelAnimationFrame(frame); overlay.remove(); };
}
