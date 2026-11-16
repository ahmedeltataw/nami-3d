import { MathUtils } from 'three';

export type Gaze = { yaw: number; pitch: number; eyeYaw: number; eyePitch: number };
export const HEAD_YAW = MathUtils.degToRad(35);
export const HEAD_PITCH = MathUtils.degToRad(20);
export const EYE_LIMIT = MathUtils.degToRad(12);
const clamp = MathUtils.clamp;

export type HeadRegion = { x: number; y: number; radius: number; visible: boolean };
export function pointerNearHead(x: number, y: number, head: HeadRegion) {
  return head.visible && head.radius > 0 && Math.hypot(x - head.x, y - head.y) <= head.radius;
}

export function createHeadReaction() {
  let last = -Infinity;
  return (now: number) => {
    if (!Number.isFinite(now) || now - last < 3) return false;
    last = now;
    return true;
  };
}

export function floatY(time: number, reduced = false) { return reduced ? 0 : 0.04 * Math.sin(0.9 * time); }
export function floatRoll(time: number, reduced = false) { return reduced ? 0 : MathUtils.degToRad(0.6) * Math.sin(0.7 * time); }
export function eyeFollow(angle: number, head: number) { return clamp(angle - head, -EYE_LIMIT, EYE_LIMIT); }

// x/y/z is a direction in the robot's local (+Z forward) space. Caller owns out.
export function lookAt(x: number, y: number, z: number, current: Readonly<Gaze>, delta: number, out: Gaze, reduced = false): Gaze {
  if (reduced) { out.yaw = out.pitch = out.eyeYaw = out.eyePitch = 0; return out; }
  const yaw = Math.atan2(x, z);
  const pitch = -Math.atan2(y, Math.hypot(x, z));
  const alpha = 1 - Math.exp(-6 * Math.max(0, delta));
  out.yaw = MathUtils.lerp(current.yaw, clamp(yaw, -HEAD_YAW, HEAD_YAW), alpha);
  out.pitch = MathUtils.lerp(current.pitch, clamp(pitch, -HEAD_PITCH, HEAD_PITCH), alpha);
  out.eyeYaw = MathUtils.lerp(current.eyeYaw, eyeFollow(yaw, out.yaw), alpha);
  out.eyePitch = MathUtils.lerp(current.eyePitch, eyeFollow(pitch, out.pitch), alpha);
  return out;
}
