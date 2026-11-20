import { AmbientLight, Color, DirectionalLight, FogExp2, Group, MeshBasicMaterial, PointLight, type Material, type Mesh, type Object3D, type Scene } from 'three';
import type { SceneId } from '../contracts';
import { excludeLights, getExcludedLights, isSupportedMaterial, refreshLightExclusion, type SupportedLight } from '../shared/light-exclusion';
import { lightingWeights, rigs, type LightingTransition } from './rigs';
import type { LightSpec } from './types';

const matteNames = new Set(['S01_window_city', 'S03_backdrop_city', 'S04_city', 'S07_sky_city']);
const floorNames = new Set(['S06_floor', 'S06_floor_seams']);
const sunNames = new Set(['S07_N', 'S07_N_rim_front', 'S07_N_rim_back', 'Right_SideModule', 'Left_SideModule', 'Face_Bezel', 'Face_Display']);
const treeNames = new Set(['S07_tree_branch', 'S07_tree_leaves']);
function namedAncestor(node: Object3D, names: Set<string>) {
  for (let current: Object3D | null = node; current; current = current.parent) if (names.has(current.name)) return true;
  return false;
}
function makeLight(spec: LightSpec) {
  const light = spec.kind === 'point' ? new PointLight(spec.color, 0, spec.distance ?? 0, 2) : new DirectionalLight(spec.color, 0);
  light.name = spec.name;
  light.position.fromArray(spec.position);
  if (light instanceof DirectionalLight) light.target.position.fromArray(spec.target ?? [0, 0, 0]);
  return light;
}
type Binding = { original: Material | Material[]; owned: Material[]; signature: string };

/** Stable light objects; only intensities change when the runtime blends two rigs. */
export class LightingController {
  readonly root = new Group();
  readonly fog = new FogExp2('#000000', 0);
  readonly post = { exposure: 1, contrast: 1, bloom: { threshold: .9, strength: 0, radius: .5 } };
  readonly entries = Object.values(rigs).map(rig => {
    const group = new Group();
    group.name = `Lighting_${rig.scene}`;
    group.visible = false;
    const specs = [rig.key, rig.fill, rig.rim, ...rig.emissive];
    const lights = specs.map(makeLight);
    const ambient = new AmbientLight(rig.ambient.color, 0);
    group.add(ambient);
    lights.forEach(light => { group.add(light); if (light instanceof DirectionalLight) group.add(light.target); });
    return { rig, group, specs, lights, ambient };
  });
  private bindings = new Map<Mesh, Binding>();
  private topology = '';
  private boundRoots: Object3D[] = [];
  private boundOwner: SceneId | null = null;
  private boundWorld: Scene | null = null;
  private boundExclusions = true;
  private materialsDirty = true;
  private color = new Color();
  constructor() {
    this.root.name = 'SceneLighting';
    this.root.add(...this.entries.map(entry => entry.group));
  }
  update(scene: SceneId, intents: LightingTransition | null, world: Scene, roots: readonly Object3D[], exclusions = true) {
    const weights = lightingWeights(scene, intents);
    const topology = this.entries.filter(entry => (weights[entry.rig.scene] ?? 0) > 0).map(entry => entry.rig.scene).join(',');
    let total = 0;
    this.post.exposure = this.post.contrast = this.post.bloom.threshold = this.post.bloom.strength = this.post.bloom.radius = this.fog.density = 0;
    this.fog.color.setRGB(0, 0, 0);
    for (const entry of this.entries) {
      const weight = weights[entry.rig.scene] ?? 0;
      entry.group.visible = weight > 0;
      entry.ambient.intensity = entry.rig.ambient.intensity * weight;
      entry.lights.forEach((light, i) => { light.intensity = entry.specs[i].intensity * weight; });
      if (weight <= 0) continue;
      const rig = entry.rig;
      total += weight;
      this.post.exposure += rig.exposure * weight;
      this.post.contrast += rig.contrast * weight;
      this.post.bloom.threshold += rig.bloom.threshold * weight;
      this.post.bloom.strength += rig.bloom.strength * weight;
      this.post.bloom.radius += rig.bloom.radius * weight;
      this.fog.density += rig.fog.density * weight;
      this.fog.color.add(this.color.set(rig.fog.color).multiplyScalar(weight));
    }
    // Post values interpolate; light intensities retain the runtime's unnormalised fade weights.
    if (total > 0) {
      this.post.exposure /= total; this.post.contrast /= total;
      this.post.bloom.threshold /= total; this.post.bloom.strength /= total; this.post.bloom.radius /= total;
      this.fog.density /= total; this.fog.color.multiplyScalar(1 / total);
    } else {
      const rig = rigs[scene];
      this.post.exposure = rig.exposure; this.post.contrast = rig.contrast;
      Object.assign(this.post.bloom, rig.bloom);
    }
    world.fog = this.fog.density > 0 ? this.fog : null;
    const owner = intents?.owner ?? scene;
    if (owner !== this.boundOwner || world !== this.boundWorld || exclusions !== this.boundExclusions || roots.length !== this.boundRoots.length || roots.some((root, index) => root !== this.boundRoots[index])) this.materialsDirty = true;
    if (this.materialsDirty) {
      this.reconcileMaterials(owner, world, roots, exclusions);
      this.boundOwner = owner;
      this.boundRoots = [...roots];
      this.boundWorld = world;
      this.boundExclusions = exclusions;
      this.materialsDirty = false;
    }
    if (topology !== this.topology) {
      for (const binding of this.bindings.values()) for (const material of binding.owned) if (isSupportedMaterial(material)) refreshLightExclusion(material);
      this.topology = topology;
    }
  }
  invalidateMaterials = () => { this.materialsDirty = true; };
  private reconcileMaterials(owner: SceneId, world: Scene, roots: readonly Object3D[], exclusions: boolean) {
    for (const [mesh, binding] of this.bindings) {
      let ancestor: Object3D = mesh;
      while (ancestor.parent) ancestor = ancestor.parent;
      if (ancestor !== world) {
        mesh.material = binding.original;
        binding.owned.forEach(material => material.dispose());
        this.bindings.delete(mesh);
      }
    }
    for (const root of roots) root.traverse(node => {
      if ('isMesh' in node && node.isMesh) this.bind(node as Mesh, owner, world, exclusions);
    });
  }
  private bind(mesh: Mesh, scene: SceneId, world: Scene, exclusions: boolean) {
    const matte = namedAncestor(mesh, matteNames);
    const entry = this.entries.find(entry => entry.rig.scene === scene)!;
    const excluded: SupportedLight[] = [];
    if (exclusions && scene === 's06' && namedAncestor(mesh, floorNames)) excluded.push(entry.lights[0]);
    if (exclusions && scene === 's07') {
      if (namedAncestor(mesh, sunNames)) excluded.push(entry.lights[0]);
      if (namedAncestor(mesh, treeNames)) excluded.push(entry.lights[1]);
    }
    const signature = `${matte}|${scene}|${excluded.map(light => light.name).join(',')}`;
    const previous = this.bindings.get(mesh);
    if (previous?.signature === signature) return;
    if (previous) { mesh.material = previous.original; previous.owned.forEach(material => material.dispose()); this.bindings.delete(mesh); }
    const original = mesh.material;
    if (!matte && !excluded.length && rigs[scene].emissiveTrim === 1) return;
    const owned = (Array.isArray(original) ? original : [original]).map(material => {
      if (matte) {
        const source = material as MeshBasicMaterial;
        if (source.isMeshBasicMaterial) {
          const unlit = source.clone();
          unlit.onBeforeCompile = source.onBeforeCompile;
          unlit.customProgramCacheKey = source.customProgramCacheKey;
          unlit.fog = false;
          return unlit;
        }
        const emission = isSupportedMaterial(material) && material.emissiveMap;
        const unlit = new MeshBasicMaterial({ color: emission ? material.emissive : source.color, map: emission || source.map, alphaMap: source.alphaMap,
          transparent: source.transparent, opacity: source.opacity, alphaTest: source.alphaTest,
          side: source.side, vertexColors: source.vertexColors, fog: false, depthWrite: source.depthWrite });
        unlit.name = source.name;
        unlit.toneMapped = false;
        return unlit;
      }
      const clone = material.clone();
      if (isSupportedMaterial(material) && getExcludedLights(material).length === 0) {
        clone.onBeforeCompile = material.onBeforeCompile;
        clone.customProgramCacheKey = material.customProgramCacheKey;
      }
      if (isSupportedMaterial(clone)) {
        clone.emissiveIntensity *= rigs[scene].emissiveTrim;
        if (excluded.length) excludeLights(clone, excluded, { scene: world });
      }
      return clone;
    });
    mesh.material = Array.isArray(original) ? owned : owned[0];
    this.bindings.set(mesh, { original, owned, signature });
  }
  dispose() {
    for (const [mesh, binding] of this.bindings) { mesh.material = binding.original; binding.owned.forEach(material => material.dispose()); }
    this.bindings.clear();
    this.root.removeFromParent();
    this.boundRoots = [];
    this.boundOwner = null;
    this.boundWorld = null;
    this.materialsDirty = true;
    this.topology = '';
  }
}
