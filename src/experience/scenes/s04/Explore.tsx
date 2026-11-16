'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './explore.module.css';
import { useExperienceStore } from '../../store';

export function Explore({ locale }: { locale: string }) {
  const ar = locale === 'ar';
  const renderer = useExperienceStore(state => state.profile.renderer);
  const [active, setActive] = useState(false);
  const [available, setAvailable] = useState(false);
  const [layers, setLayers] = useState<Record<string, boolean>>({ frame: true, internals: true, glass: true, display: true });
  const pointers = useRef(new Map<number, [number, number]>());
  const send = (detail: object) => window.dispatchEvent(new CustomEvent('nami:explore', { detail }));
  useEffect(() => {
    function sync(event: Event) { setActive((event as CustomEvent<boolean>).detail); }
    function progress(event: Event) { setAvailable((event as CustomEvent<boolean>).detail); }
    window.addEventListener('nami:s04-progress', progress);
    window.addEventListener('nami:explore-state', sync);
    return () => { window.removeEventListener('nami:explore-state', sync); window.removeEventListener('nami:s04-progress', progress); };
  }, []);
  useEffect(() => {
    if (!active) return;
    function key(event: KeyboardEvent) {
      const orbit: Record<string, [number, number]> = { ArrowLeft: [-.12, 0], ArrowRight: [.12, 0], ArrowUp: [0, -.12], ArrowDown: [0, .12] };
      if (event.key === 'Escape') send({ action: 'exit' });
      else if (orbit[event.key]) { event.preventDefault(); send({ action: 'orbit', x: orbit[event.key][0], y: orbit[event.key][1] }); }
      else if (['+', '=', '-'].includes(event.key)) { event.preventDefault(); send({ action: 'zoom', amount: event.key === '-' ? .25 : -.25 }); }
    }
    function wheel(event: WheelEvent) {
      if (event.ctrlKey) { event.preventDefault(); send({ action: 'zoom', amount: event.deltaY * .002 }); }
      else send({ action: 'exit' });
    }
    function scroll() { send({ action: 'exit' }); setActive(false); }
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('keydown', key); window.addEventListener('wheel', wheel, { passive: false });
    return () => { window.removeEventListener('scroll', scroll); window.removeEventListener('keydown', key); window.removeEventListener('wheel', wheel); };
  }, [active]);
  function down(event: React.PointerEvent<HTMLDivElement>) { event.currentTarget.setPointerCapture(event.pointerId); pointers.current.set(event.pointerId, [event.clientX, event.clientY]); }
  function move(event: React.PointerEvent<HTMLDivElement>) {
    const old = pointers.current.get(event.pointerId); if (!old) return;
    const all = [...pointers.current.entries()];
    if (all.length > 1) {
      const other = all.find(([id]) => id !== event.pointerId)?.[1];
      if (other) send({ action: 'zoom', amount: (Math.hypot(old[0] - other[0], old[1] - other[1]) - Math.hypot(event.clientX - other[0], event.clientY - other[1])) * .01 });
    } else send({ action: 'orbit', x: (event.clientX - old[0]) * .008, y: (event.clientY - old[1]) * .008 });
    pointers.current.set(event.pointerId, [event.clientX, event.clientY]);
  }
  return <div className={styles.panel}>
    {active && <div className={styles.surface} aria-hidden="true" onPointerDown={down} onPointerMove={move} onPointerUp={event => pointers.current.delete(event.pointerId)} onPointerCancel={event => pointers.current.delete(event.pointerId)} />}
    {renderer === 'fallback' && <p className={styles.fallback}>{ar ? 'من الفكرة إلى الواقع' : 'From idea to reality'}</p>}
    <div className={styles.controls}>
      {renderer === 'fallback' && <p className={styles.fallback}>{ar ? 'من الفكرة إلى الواقع' : 'From idea to reality'}</p>}
      {!active && available ? <button type="button" onClick={() => send({ action: 'enter' })} aria-label={ar ? 'استكشف الهاتف' : 'Explore phone'}>{ar ? 'استكشف' : 'Explore'}</button> : active ? <>
        <button type="button" onClick={() => send({ action: 'exit' })} aria-label={ar ? 'إنهاء الاستكشاف' : 'Exit exploration'}>{ar ? 'خروج' : 'Exit'}</button>
        <button type="button" onClick={() => send({ action: 'replay' })} aria-label={ar ? 'إعادة التجميع' : 'Replay assembly'}>{ar ? 'إعادة التجميع' : 'Replay assembly'}</button>
        {Object.keys(layers).map(key => <button type="button" key={key} aria-pressed={layers[key]} aria-label={ar ? ({ frame: 'الإطار', internals: 'المكونات الداخلية', glass: 'الزجاج', display: 'الشاشة' } as Record<string,string>)[key] : key} onClick={() => { const visible = !layers[key]; setLayers({ ...layers, [key]: visible }); send({ action: 'layer', key, visible }); }}>{ar ? ({ frame: 'الإطار', internals: 'المكونات الداخلية', glass: 'الزجاج', display: 'الشاشة' } as Record<string,string>)[key] : key}</button>)}
      </> : null}
    </div>
  </div>;
}
