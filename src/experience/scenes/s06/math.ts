import { seededRandom } from '../../shared/particles/random';

export const VALUES_COUNT = 7;
export const VALUES_START = 0.10;
export const VALUES_END = 0.70;
export const VALUES_SPAN = VALUES_END - VALUES_START;
export const VALUE_WINDOW = VALUES_SPAN / VALUES_COUNT;

export type S06Phase = 'ambient' | 'values' | 'converge' | 'reveal';

export function getValueIndex(local: number): number {
  if (local < VALUES_START) return 0;
  if (local >= VALUES_END) return VALUES_COUNT - 1;
  return Math.min(VALUES_COUNT - 1, Math.max(0, Math.floor((local - VALUES_START + 1e-9) / VALUE_WINDOW)));
}

export function getValueWindow(index: number): { start: number; end: number } {
  const clamped = Math.min(VALUES_COUNT - 1, Math.max(0, index));
  const start = VALUES_START + clamped * VALUE_WINDOW;
  return { start, end: start + VALUE_WINDOW };
}

export function getS06Phase(local: number): S06Phase {
  if (local < 0.10) return 'ambient';
  if (local < 0.70) return 'values';
  if (local < 0.90) return 'converge';
  return 'reveal';
}

export function getParticleTargetMode(local: number): string {
  const phase = getS06Phase(local);
  if (phase === 'ambient') return 'ambient';
  if (phase === 'values') return `value_${getValueIndex(local)}`;
  return 'logo';
}

/** Pre-generates deterministic procedural targets for a specific company value shape. */
export function generateValueTargets(index: number, count: number, seed = 42): Float32Array {
  const result = new Float32Array(count * 3);
  const rand = seededRandom(seed + index * 100);
  const cx = 0.65;
  const cy = 0.25;
  const cz = 0.0;

  switch (index) {
    case 0: {
      // Innovation: Helix / Swirling Torus
      const R = 0.65;
      const r = 0.22;
      for (let i = 0; i < count; i++) {
        const u = (i / count) * Math.PI * 2;
        const v = u * 4 + rand() * 0.2;
        const j = i * 3;
        result[j] = cx + (R + r * Math.cos(v)) * Math.cos(u);
        result[j + 1] = cy + (R + r * Math.cos(v)) * Math.sin(u);
        result[j + 2] = cz + r * Math.sin(v);
      }
      break;
    }
    case 1: {
      // Quality: Cube wireframe
      const s = 0.75;
      const hs = s / 2;
      for (let i = 0; i < count; i++) {
        const edge = Math.floor(rand() * 12);
        const t = (rand() - 0.5) * s;
        let x = 0, y = 0, z = 0;
        switch (edge) {
          case 0: x = t; y = -hs; z = -hs; break;
          case 1: x = t; y = hs; z = -hs; break;
          case 2: x = t; y = -hs; z = hs; break;
          case 3: x = t; y = hs; z = hs; break;
          case 4: x = -hs; y = t; z = -hs; break;
          case 5: x = hs; y = t; z = -hs; break;
          case 6: x = -hs; y = t; z = hs; break;
          case 7: x = hs; y = t; z = hs; break;
          case 8: x = -hs; y = -hs; z = t; break;
          case 9: x = hs; y = -hs; z = t; break;
          case 10: x = -hs; y = hs; z = t; break;
          default: x = hs; y = hs; z = t; break;
        }
        const j = i * 3;
        result[j] = cx + x;
        result[j + 1] = cy + y;
        result[j + 2] = cz + z;
      }
      break;
    }
    case 2: {
      // Client focus: Concentric Rings
      const r1 = 0.7;
      const r2 = 0.45;
      for (let i = 0; i < count; i++) {
        const inner = rand() > 0.5;
        const r = inner ? r2 : r1;
        const angle = rand() * Math.PI * 2;
        const tilt = inner ? 0.3 : -0.3;
        const j = i * 3;
        result[j] = cx + Math.cos(angle) * r;
        result[j + 1] = cy + Math.sin(angle) * r * Math.cos(tilt);
        result[j + 2] = cz + Math.sin(angle) * r * Math.sin(tilt);
      }
      break;
    }
    case 3: {
      // Teamwork: Double interlocking rings
      const r = 0.42;
      for (let i = 0; i < count; i++) {
        const first = i % 2 === 0;
        const u = rand() * Math.PI * 2;
        const offsetX = first ? -0.22 : 0.22;
        const j = i * 3;
        if (first) {
          result[j] = cx + offsetX + Math.cos(u) * r;
          result[j + 1] = cy + Math.sin(u) * r;
          result[j + 2] = cz;
        } else {
          result[j] = cx + offsetX + Math.cos(u) * r;
          result[j + 1] = cy;
          result[j + 2] = cz + Math.sin(u) * r;
        }
      }
      break;
    }
    case 4: {
      // Quick response: Dynamic Chevron / Lightning
      for (let i = 0; i < count; i++) {
        const t = i / count;
        const seg = t < 0.5 ? 0 : 1;
        const u = seg === 0 ? t * 2 : (t - 0.5) * 2;
        const j = i * 3;
        if (seg === 0) {
          result[j] = cx - 0.4 + u * 0.45;
          result[j + 1] = cy - 0.45 + u * 0.6;
          result[j + 2] = cz + (rand() - 0.5) * 0.08;
        } else {
          result[j] = cx + 0.05 + u * 0.4;
          result[j + 1] = cy + 0.15 - u * 0.6;
          result[j + 2] = cz + (rand() - 0.5) * 0.08;
        }
      }
      break;
    }
    case 5: {
      // Continuous learning: Lemniscate of Bernoulli (Infinity loop)
      const a = 0.72;
      for (let i = 0; i < count; i++) {
        const t = (i / count) * Math.PI * 2;
        const denom = 1 + Math.sin(t) * Math.sin(t);
        const j = i * 3;
        result[j] = cx + (a * Math.cos(t)) / denom;
        result[j + 1] = cy + (a * Math.sin(t) * Math.cos(t)) / denom;
        result[j + 2] = cz + Math.sin(t * 2) * 0.12;
      }
      break;
    }
    case 6:
    default: {
      // Sustainability: Spherical Dome / Spiral
      const R = 0.65;
      for (let i = 0; i < count; i++) {
        const phi = Math.acos(1 - 2 * (i / count));
        const theta = Math.sqrt(count * Math.PI) * phi;
        const j = i * 3;
        result[j] = cx + R * Math.sin(phi) * Math.cos(theta);
        result[j + 1] = cy + R * Math.cos(phi) * 0.8;
        result[j + 2] = cz + R * Math.sin(phi) * Math.sin(theta);
      }
      break;
    }
  }

  // Ensure all points are strictly finite
  for (let i = 0; i < result.length; i++) {
    if (!Number.isFinite(result[i])) result[i] = 0;
  }

  return result;
}
