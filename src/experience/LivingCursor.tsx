'use client';
import { useEffect, useRef, useState } from 'react';
import { cursorEnabled, magneticOffset } from './cursor';
import { useExperienceStore } from './store';
import styles from './LivingCursor.module.css';

export function LivingCursor() {
  const [enabled, setEnabled] = useState(false);
  const ring = useRef<HTMLDivElement>(null);
  const motion = useExperienceStore(state => state.profile.motion);
  useEffect(() => {
    const fine = matchMedia('(pointer: fine)');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    function update() { setEnabled(cursorEnabled(fine.matches, reduced.matches || motion === 'reduced')); }
    update(); fine.addEventListener('change', update); reduced.addEventListener('change', update);
    return () => { fine.removeEventListener('change', update); reduced.removeEventListener('change', update); };
  }, [motion]);
  useEffect(() => {
    let grabTimer = 0;
    function stopGrab() { window.clearTimeout(grabTimer); useExperienceStore.setState({ cursorGrab: false }); }
    function down(event: PointerEvent) {
      stopGrab();
      const target = event.target instanceof Element ? event.target : null;
      const scene = useExperienceStore.getState().scene;
      if (event.button !== 0 || !['s01', 's06', 's07'].includes(scene) || !target?.closest(`#${scene}`) || target.closest('a, button, input, textarea, select, [role="button"]')) return;
      grabTimer = window.setTimeout(() => { if (useExperienceStore.getState().scene === scene) useExperienceStore.setState({ cursorGrab: true }); }, 400);
    }
    window.addEventListener('pointerdown', down); window.addEventListener('pointerup', stopGrab);
    window.addEventListener('pointercancel', stopGrab); window.addEventListener('blur', stopGrab);
    return () => { stopGrab(); window.removeEventListener('pointerdown', down); window.removeEventListener('pointerup', stopGrab); window.removeEventListener('pointercancel', stopGrab); window.removeEventListener('blur', stopGrab); };
  }, []);
  useEffect(() => {
    if (!enabled || !ring.current) return;
    const node = ring.current;
    let x = 0, y = 0, targetX = 0, targetY = 0, frame = 0, timer = 0;
    let initialized = false;
    const root = document.documentElement;
    function hide() { node.style.opacity = '0'; root.classList.remove(styles.cursorActive); }
    function draw() {
      x += (targetX - x) * .2; y += (targetY - y) * .2;
      node.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      if (Math.abs(targetX - x) + Math.abs(targetY - y) > .1) frame = requestAnimationFrame(draw); else frame = 0;
    }
    function move(event: PointerEvent) {
      if (event.pointerType !== 'mouse') { hide(); return; }
      const element = event.target instanceof Element ? event.target : null;
      if (element?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) { hide(); return; }
      const interactive = element?.closest('a, button, [role="button"]');
      const magnetic = interactive?.matches('[data-magnetic]') ? interactive : null;
      targetX = event.clientX; targetY = event.clientY;
      if (magnetic) { const rect = magnetic.getBoundingClientRect(); targetX += magneticOffset(rect.left + rect.width / 2 - targetX); targetY += magneticOffset(rect.top + rect.height / 2 - targetY); }
      node.dataset.interactive = interactive ? 'true' : 'false';
      if (!initialized) { x = targetX; y = targetY; initialized = true; }
      node.style.opacity = '1'; root.classList.add(styles.cursorActive);
      if (!frame) frame = requestAnimationFrame(draw);
      window.clearTimeout(timer); timer = window.setTimeout(hide, 1000);
    }
    function key() { hide(); }
    function pointerDown(event: PointerEvent) { if (event.pointerType !== 'mouse') hide(); }
    window.addEventListener('pointermove', move, { passive: true }); window.addEventListener('pointerdown', pointerDown);
    window.addEventListener('blur', key); window.addEventListener('keydown', key);
    return () => { hide(); cancelAnimationFrame(frame); clearTimeout(timer); window.removeEventListener('pointermove', move); window.removeEventListener('pointerdown', pointerDown); window.removeEventListener('blur', key); window.removeEventListener('keydown', key); };
  }, [enabled]);
  return enabled ? <div ref={ring} className={styles.cursor} data-living-cursor aria-hidden="true"><span /></div> : null;
}
