export function cursorEnabled(fine: boolean, reduced: boolean) { return fine && !reduced; }
export function magneticOffset(delta: number) { return Math.max(-8, Math.min(8, delta * .15)); }
