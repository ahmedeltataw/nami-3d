import { clamp } from '../scroll-map';
import type { SceneId, TransitionId } from '../contracts';

export type Interval = readonly [number, number];
export type JumpBeats = {
  charge: Interval; open: Interval; dive: Interval; dissolve: Interval;
  pass: Interval; opaque: Interval; emerge: Interval; land: Interval;
  washIn: Interval; washOut: Interval;
};
export type BoundaryOverride = { beats?: Partial<JumpBeats>; portal?: { anchor: [number, number, number]; radius: number } };
export const DEFAULT_JUMP_BEATS: JumpBeats = {
  charge: [0, .15], open: [.10, .30], dive: [.30, .50], dissolve: [.42, .48],
  pass: [.48, .60], opaque: [.53, .59], emerge: [.60, .78], land: [.72, 1],
  washIn: [.45, .53], washOut: [.59, .65],
};
export const BOUNDARY_OVERRIDES: Partial<Record<TransitionId, BoundaryOverride>> = {
  's02->s03': { beats: { charge: [0, .10], open: [.05, .20], dive: [.20, .40], dissolve: [.34, .40], pass: [.38, .62], opaque: [.55, .60], emerge: [.62, .78], washIn: [.48, .55], washOut: [.60, .66] } },
  's03->s04': { beats: { opaque: [.55, .58], washIn: [.45, .55], washOut: [.58, .65] } },
  's06->s07': { beats: { opaque: [.54, .58], washIn: [.45, .54], washOut: [.58, .65] } },
};
export function resolveBeats(override: BoundaryOverride['beats'] = {}): JumpBeats {
  const beats = { ...DEFAULT_JUMP_BEATS, ...override };
  if (override.dive && !override.dissolve) {
    const duration = DEFAULT_JUMP_BEATS.dissolve[1] - DEFAULT_JUMP_BEATS.dissolve[0];
    beats.dissolve = [Math.max(beats.dive[0], beats.dive[1] - duration), beats.dive[1]];
  }
  return beats;
}
export const beatsFor = (id: TransitionId): JumpBeats => resolveBeats(BOUNDARY_OVERRIDES[id]?.beats);
export const ramp = (t: number, interval: Interval) => clamp((t - interval[0]) / (interval[1] - interval[0]));
export function jumpOwnership(from: SceneId, to: SceneId, t: number, beats: JumpBeats = DEFAULT_JUMP_BEATS) {
  const swap = (beats.opaque[0] + beats.opaque[1]) / 2;
  const owner = t < swap ? from : to;
  const visibility = ramp(t, beats.opaque);
  return { owner, fromVisibility: 1 - visibility, toVisibility: visibility };
}
export function ambientWeight(t: number | null, reduced = false, beats = DEFAULT_JUMP_BEATS) {
  if (reduced) return 0;
  if (t === null) return 1;
  return 1 - ramp(t, beats.charge) + ramp(t, beats.land);
}
export function readinessPresentation(t: number | null, ready: boolean, cold: boolean, beats = DEFAULT_JUMP_BEATS) {
  return { hold: t !== null && !ready && t >= beats.pass[0], poster: cold && t !== null && !ready };
}
