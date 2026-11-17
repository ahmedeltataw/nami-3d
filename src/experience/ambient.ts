// Fade a bounded angular offset, never the cumulative running clock.
export function ambientAngle(time: number, rate: number, weight = 1) {
  const angle = time * rate;
  return Math.atan2(Math.sin(angle), Math.cos(angle)) * weight;
}
