export const unit = (p: number) => Math.max(0, Math.min(1, Number.isFinite(p) ? p : 0));

export function segmentDistance(assemble: number, index: number, count = 10) {
  const phase = unit((unit(assemble) - index / count * .55) / .45);
  return 2.6 * (1 - phase * phase * (3 - 2 * phase));
}

/** Sampled activation coordinate; never integrated across frames. */
export function ringAngles(ringSpeed: number, time = 1) {
  return { outer: -Math.max(0, ringSpeed) * time, inner: Math.max(0, ringSpeed) * time * 1.35 };
}
