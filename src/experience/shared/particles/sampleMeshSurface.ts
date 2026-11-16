import { Vector3, type BufferGeometry } from 'three';
import { assertCount, seededRandom } from './random';

/** Samples local-space triangles, indexed or non-indexed, without changing geometry. */
export function sampleMeshSurface(geometry: BufferGeometry, count: number, seed: number): Float32Array {
  assertCount(count);
  const result = new Float32Array(count * 3);
  if (count === 0) return result;
  const position = geometry.getAttribute('position');
  if (!position || position.itemSize < 3) throw new Error('Surface geometry needs a vec3 position attribute');
  const index = geometry.getIndex();
  const triangleCount = Math.floor((index?.count ?? position.count) / 3);
  const cumulative = new Float64Array(triangleCount);
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), ab = new Vector3(), ac = new Vector3();
  function triangle(i: number) {
    a.fromBufferAttribute(position, index ? index.getX(i * 3) : i * 3);
    b.fromBufferAttribute(position, index ? index.getX(i * 3 + 1) : i * 3 + 1);
    c.fromBufferAttribute(position, index ? index.getX(i * 3 + 2) : i * 3 + 2);
  }
  let area = 0;
  for (let i = 0; i < triangleCount; i++) {
    triangle(i);
    area += ab.subVectors(b, a).cross(ac.subVectors(c, a)).length() * 0.5;
    cumulative[i] = area;
  }
  if (!(area > 0) || !Number.isFinite(area)) throw new Error('Surface geometry must have finite, non-zero triangle area');
  const random = seededRandom(seed);
  for (let i = 0; i < count; i++) {
    const pick = random() * area;
    let low = 0, high = triangleCount - 1;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (pick < cumulative[middle]) high = middle;
      else low = middle + 1;
    }
    triangle(low);
    const root = Math.sqrt(random()), v = random();
    a.multiplyScalar(1 - root).addScaledVector(b, root * (1 - v)).addScaledVector(c, root * v).toArray(result, i * 3);
  }
  return result;
}
