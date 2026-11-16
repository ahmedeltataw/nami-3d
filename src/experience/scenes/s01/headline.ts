import { clamp } from '../../controller';

/** Percentage for a whole-text clip, preserving the browser's Arabic shaping. */
export function headlineReveal(progress: number): number {
  const t = clamp(progress);
  return 100 * t * t * (3 - 2 * t);
}

export function drawEnergyLine(canvas: HTMLCanvasElement, headline: DOMRect, hand: { x: number; y: number }, progress: number, rtl: boolean, dpr: number) {
  const width = window.innerWidth, height = window.innerHeight;
  const ratio = Math.min(2, dpr);
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const p = clamp(progress);
  if (p <= 0 || p >= 1) return;
  const y = headline.bottom + 6;
  const startX = rtl ? headline.right : headline.left;
  const endX = rtl ? headline.left : headline.right;
  const morph = clamp((p - .3) / .7);
  const x0 = hand.x + (startX - hand.x) * morph;
  const y0 = hand.y + (y - hand.y) * morph;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  // Sample the same quadratic at every progress; no elapsed-time integration.
  for (let i = 1; i <= 80; i++) {
    const t = i / 80 * clamp(p / .65), inv = 1 - t;
    ctx.lineTo(inv * inv * x0 + 2 * inv * t * startX + t * t * endX, inv * inv * y0 + (2 * inv * t + t * t) * y);
  }
  ctx.strokeStyle = '#009f6f';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.shadowColor = '#00d99b';
  ctx.shadowBlur = 14;
  ctx.globalAlpha = 1 - clamp((p - .85) / .15);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
