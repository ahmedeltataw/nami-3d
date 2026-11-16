/** Mulberry32: a local stream, independent of the browser's random state. */
export function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(value ^ (value >>> 15), value | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

export function assertCount(count: number): void {
  if (!Number.isSafeInteger(count) || count < 0) throw new RangeError('Particle count must be a non-negative integer');
}
