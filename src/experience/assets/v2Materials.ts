import {
  AdditiveBlending,
  type BufferGeometry,
  Color,
  DoubleSide,
  FrontSide,
  type Material,
  Mesh,
  MeshBasicMaterial,
  type MeshStandardMaterial,
  type Object3D,
} from 'three';
import type { SceneId } from '../contracts';

const S01_ADDITIVE = new Set([
  'M_S01_DiscRing',
  'M_S01_DiscLogo',
  'M_S01_Strip',
  'M_S01_CeilLip',
  'M_S01_CeilPod',
  'M_S01_Swirl',
  'M_S01_Spark',
]);

const S07_ADDITIVE = new Set([
  'M_Trail',
  'M_Trail_Halo',
  'M_Orbit_S07',
  'M_Orbit_Arc',
  'M_N_Rim_front',
  'M_N_Rim_back',
]);

const TRANSLUCENT_GLASS: Record<string, { opacity: number; additive: boolean }> = {
  M_Bubble_Glass: { opacity: 0.16, additive: true },
  M_Globe_Glass: { opacity: 0.22, additive: true },
  M_Helix_Glass: { opacity: 0.28, additive: true },
  M_Glass_N: { opacity: 0.6, additive: false },
};

function convertV2Material(
  source: Material,
  sceneId: SceneId,
  cache: Map<Material, Material>,
  ownedMaterials: Material[],
): Material {
  const existing = cache.get(source);
  if (existing) return existing;

  const std = source as MeshStandardMaterial;
  const name = source.name;
  let next: Material | null = null;

  if (name === 'M_Beam') {
    const color = std.emissive?.clone() ?? new Color('#A8FFE6');
    next = new MeshBasicMaterial({
      name,
      color,
      transparent: true,
      opacity: sceneId === 's04' ? 0.12 : 0.16,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    });
  } else if (name in TRANSLUCENT_GLASS) {
    const spec = TRANSLUCENT_GLASS[name];
    if (spec.additive) {
      const color = std.emissive?.clone() ?? std.color?.clone() ?? new Color('#7CFFD9');
      next = new MeshBasicMaterial({
        name,
        color,
        transparent: true,
        opacity: spec.opacity,
        blending: AdditiveBlending,
        depthWrite: false,
        side: FrontSide,
      });
    } else {
      const clone = source.clone();
      clone.transparent = true;
      clone.opacity = spec.opacity;
      clone.depthWrite = false;
      next = clone;
    }
  } else if (name === 'M_S01_Leaf') {
    // s01_hero_v2.manifest.json: vertex colour x1.8 + 0.9 self-glow (stored in COLOR_1).
    next = new MeshBasicMaterial({
      name,
      color: new Color(2.2, 2.2, 2.2),
      vertexColors: true,
      side: DoubleSide,
      toneMapped: true,
    });
  } else if (name === 'M_Rock' || name === 'M_Grass' || name === 'M_Leaf') {
    const clone = source.clone() as MeshStandardMaterial;
    clone.vertexColors = true;
    if (name === 'M_Grass' || name === 'M_Leaf') clone.side = DoubleSide;
    next = clone;
  } else if ((sceneId === 's01' && S01_ADDITIVE.has(name)) || (sceneId === 's07' && S07_ADDITIVE.has(name))) {
    const clone = source.clone();
    clone.transparent = true;
    clone.blending = AdditiveBlending;
    clone.depthWrite = false;
    next = clone;
  }

  if (!next) return source;
  cache.set(source, next);
  ownedMaterials.push(next);
  return next;
}

/**
 * Promotes `COLOR_1` (`_color_1` / `color_1`) onto `color` when Blender exported
 * a white placeholder `COLOR_0` layer, and applies manifest-required runtime
 * shader flags (additive beams, translucent glass, leaf/rock vertex colors).
 */
export function applyV2RuntimeMaterials(
  root: Object3D,
  sceneId: SceneId,
  ownedMaterials: Material[],
  ownedGeometries: BufferGeometry[],
) {
  const cache = new Map<Material, Material>();

  root.traverse(object => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;

    const geom = mesh.geometry;
    const color1 = geom?.getAttribute('_color_1') ?? geom?.getAttribute('color_1');
    if (geom && color1) {
      const cloned = geom.clone();
      cloned.setAttribute('color', color1);
      mesh.geometry = cloned;
      ownedGeometries.push(cloned);
    }

    if (!mesh.material) return;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(m => convertV2Material(m, sceneId, cache, ownedMaterials))
      : convertV2Material(mesh.material, sceneId, cache, ownedMaterials);
  });
}
