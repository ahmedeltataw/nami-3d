import {
  Color,
  DoubleSide,
  MeshBasicMaterial,
  MirroredRepeatWrapping,
  type Material,
  type Mesh,
  type Object3D,
  type Texture,
} from 'three';

export interface MatteCardSpec {
  readonly node: string;
  readonly material: string;
  readonly depthWrite?: boolean;
  readonly wrap?: 'MIRRORED_REPEAT';
}

function toUnlitMatteMaterial(source: Material, spec: MatteCardSpec): MeshBasicMaterial {
  const std = source as Material & {
    map?: Texture | null;
    emissiveMap?: Texture | null;
    color?: Color;
    emissive?: Color;
    opacity?: number;
    transparent?: boolean;
    side?: typeof DoubleSide;
    toneMapped?: boolean;
  };
  const map = std.map ?? std.emissiveMap ?? null;
  if (map && spec.wrap === 'MIRRORED_REPEAT') {
    map.wrapS = MirroredRepeatWrapping;
    map.wrapT = MirroredRepeatWrapping;
    map.needsUpdate = true;
  }
  // Blender exports matte cards as emissive-only PBR materials with black baseColor.
  const tint = std.emissiveMap && std.emissive ? std.emissive.clone() : std.color?.clone() ?? new Color(1, 1, 1);
  const basic = new MeshBasicMaterial({
    name: source.name || spec.material,
    map,
    color: tint,
    side: std.side ?? DoubleSide,
    transparent: std.transparent ?? false,
    opacity: std.opacity ?? 1,
    fog: false,
    depthWrite: spec.depthWrite ?? true,
    toneMapped: std.toneMapped ?? true,
  });
  basic.userData = { ...source.userData, unlitMatte: true };
  return basic;
}

/**
 * Replaces a matte card's exported PBR material with an unlit MeshBasicMaterial
 * excluded from fog (and depth-write / MIRRORED_REPEAT wrapping when configured).
 */
export function applyMatteCardMaterial(root: Object3D, spec: MatteCardSpec, ownedMaterials: Material[]): MeshBasicMaterial[] {
  const created: MeshBasicMaterial[] = [];
  const cache = new Map<Material, MeshBasicMaterial>();
  const targetNode = root.getObjectByName(spec.node);
  const scope = targetNode ?? root;

  scope.traverse(object => {
    const mesh = object as Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const matchNode = targetNode !== undefined;
    const replaceIfMatte = (material: Material): Material => {
      if (!matchNode && material.name !== spec.material) return material;
      let basic = cache.get(material);
      if (!basic) {
        basic = toUnlitMatteMaterial(material, spec);
        cache.set(material, basic);
        ownedMaterials.push(basic);
        created.push(basic);
      }
      return basic;
    };
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(replaceIfMatte) : replaceIfMatte(mesh.material);
  });

  return created;
}
