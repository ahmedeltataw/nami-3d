/**
 * Three.js 0.187 collects visible lights in scene-graph pre-order (`projectObject`, pruning `visible=false`
 * subtrees and testing `light.layers`), sorts them in `WebGLLights.setup` by `(castShadow?2:0)+(map?1:0)`
 * descending, and partitions `directionalLights[]`, `pointLights[]`, and `spotLights[]`. `lights_fragment_begin`
 * unrolls each loop with `UNROLLED_LOOP_INDEX` = `0..N-1`. We map each excluded Light to its per-type index,
 * inject `#if (UNROLLED_LOOP_INDEX == ...)` to zero `directLight` and `#if !(...)` to skip map/shadow/BRDF work,
 * and encode indices in `customProgramCacheKey`. Limits: count changes auto-invalidate `lights.state.version`,
 * but same-count `.visible`/`castShadow`/child-order swaps require `refreshLightExclusion(mat)`; pass `layers`
 * when using camera layers; `unpatched.copy(patched)` cannot copy hooks (use `patched.clone()` or `excludeLights`).
 */

import {
  Material,
  ShaderChunk,
  type DirectionalLight,
  type Layers,
  type Light,
  type MeshPhysicalMaterial,
  type MeshStandardMaterial,
  type Object3D,
  type PointLight,
  type SpotLight,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from 'three';

export type SupportedMaterial = MeshStandardMaterial | MeshPhysicalMaterial;
export type SupportedLight = DirectionalLight | PointLight | SpotLight;
type LightBucket = 'directional' | 'point' | 'spot';

export type LightExclusionIndices = {
  directional: number[];
  point: number[];
  spot: number[];
};

export type LightExclusionOptions = {
  /** Optional scene or group root used to resolve light traversal order. */
  scene?: Object3D;
  /** Optional explicit ordered list of candidate lights in the scene. */
  lights?: readonly Light[];
  /** Optional camera layers mask; only lights passing `light.layers.test(layers)` are counted. */
  layers?: Layers;
};

export type LightExclusionScope = LightExclusionOptions | Object3D | readonly Light[];

type ExclusionState = {
  lights: SupportedLight[];
  options?: LightExclusionOptions;
  baseOnBeforeCompile: SupportedMaterial['onBeforeCompile'];
  baseCustomProgramCacheKey: SupportedMaterial['customProgramCacheKey'];
  baseClone: SupportedMaterial['clone'];
  baseCopy: SupportedMaterial['copy'];
  lastKey: string;
};

const exclusionStates = new WeakMap<SupportedMaterial, ExclusionState>();

const POINT_ANCHOR = 'getPointLightInfo( pointLight, geometryPosition, directLight );';
const SPOT_ANCHOR = 'getSpotLightInfo( spotLight, geometryPosition, directLight );';
const DIR_ANCHOR = 'getDirectionalLightInfo( directionalLight, directLight );';
const RE_DIRECT_CALL =
  'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';

const PRIOR_PATCH_PATTERN =
  /\n\t\t\/\* BEGIN_LIGHT_EXCLUSION_(?:POINT|SPOT|DIR)(?:_END)? \*\/[\s\S]*?\/\* END_LIGHT_EXCLUSION_(?:POINT|SPOT|DIR)(?:_END)? \*\//g;

export function isSupportedMaterial(material: unknown): material is SupportedMaterial {
  if (!material || typeof material !== 'object') return false;
  const candidate = material as Partial<MeshStandardMaterial & MeshPhysicalMaterial>;
  return (
    candidate.isMeshStandardMaterial === true ||
    candidate.isMeshPhysicalMaterial === true ||
    candidate.type === 'MeshStandardMaterial' ||
    candidate.type === 'MeshPhysicalMaterial'
  );
}

function getLightBucket(light: unknown): LightBucket | null {
  if (!light || typeof light !== 'object') return null;
  const candidate = light as Partial<DirectionalLight & PointLight & SpotLight>;
  if (candidate.isDirectionalLight === true || candidate.type === 'DirectionalLight') return 'directional';
  if (candidate.isPointLight === true || candidate.type === 'PointLight') return 'point';
  if (candidate.isSpotLight === true || candidate.type === 'SpotLight') return 'spot';
  return null;
}

function assertSupportedMaterial(material: unknown): asserts material is SupportedMaterial {
  if (!isSupportedMaterial(material)) {
    const label = material && typeof material === 'object' && 'type' in material
      ? String((material as { type?: unknown }).type)
      : typeof material;
    throw new TypeError(
      `Light exclusion requires MeshStandardMaterial or MeshPhysicalMaterial (received ${label})`,
    );
  }
}

function normalizeLights(lights: readonly Light[]): SupportedLight[] {
  if (!Array.isArray(lights)) {
    throw new TypeError('Excluded lights must be an array of Light instances');
  }
  const seen = new Set<SupportedLight>();
  const unique: SupportedLight[] = [];
  for (let i = 0; i < lights.length; i++) {
    const light = lights[i];
    const bucket = getLightBucket(light);
    if (!bucket) {
      const label = light && typeof light === 'object' && 'type' in light
        ? String((light as { type?: unknown }).type)
        : typeof light;
      throw new TypeError(
        `Unsupported light type for exclusion: ${label}. Expected DirectionalLight, PointLight, or SpotLight`,
      );
    }
    const supported = light as SupportedLight;
    if (!seen.has(supported)) {
      seen.add(supported);
      unique.push(supported);
    }
  }
  return unique;
}

function normalizeScope(scope?: LightExclusionScope): LightExclusionOptions | undefined {
  if (!scope) return undefined;
  if (Array.isArray(scope)) return { lights: scope };
  if (typeof scope === 'object' && ('isObject3D' in scope || 'children' in scope)) {
    return { scene: scope as Object3D };
  }
  return scope as LightExclusionOptions;
}

/** Matches `shadowCastingAndTexturingLightsFirst` in Three.js `WebGLLights.js`. */
export function compareLightsThreeOrder(lightA: Light, lightB: Light): number {
  const mapA = 'map' in lightA && Boolean((lightA as SpotLight).map) ? 1 : 0;
  const mapB = 'map' in lightB && Boolean((lightB as SpotLight).map) ? 1 : 0;
  return (lightB.castShadow ? 2 : 0) - (lightA.castShadow ? 2 : 0) + mapB - mapA;
}

function findScopeRoot(light: Object3D): Object3D {
  let current: Object3D = light;
  while (current.parent) {
    current = current.parent;
  }
  return current;
}

function isHierarchyVisible(node: Object3D): boolean {
  let current: Object3D | null = node;
  while (current) {
    if (current.visible === false) return false;
    current = current.parent;
  }
  return true;
}

function matchesLightLayers(light: Light, layers?: Layers): boolean {
  if (!layers || !light.layers) return true;
  return light.layers.test(layers);
}

function collectVisibleLightsFromRoot(
  root: Object3D,
  out: Light[],
  seen: Set<Light>,
  layers?: Layers,
): void {
  function visit(node: Object3D): void {
    if (node.visible === false) return;
    if (getLightBucket(node) !== null) {
      const light = node as Light;
      if (matchesLightLayers(light, layers) && !seen.has(light)) {
        seen.add(light);
        out.push(light);
      }
    }
    const children = node.children;
    for (let i = 0; i < children.length; i++) {
      visit(children[i]);
    }
  }
  visit(root);
}

function collectCandidateLights(
  excludedLights: readonly SupportedLight[],
  options?: LightExclusionOptions,
): Light[] {
  const candidates: Light[] = [];
  const seen = new Set<Light>();
  const layers = options?.layers;

  if (options?.lights) {
    for (let i = 0; i < options.lights.length; i++) {
      const light = options.lights[i];
      if (
        getLightBucket(light) !== null &&
        isHierarchyVisible(light) &&
        matchesLightLayers(light, layers) &&
        !seen.has(light)
      ) {
        seen.add(light);
        candidates.push(light);
      }
    }
    return candidates;
  }

  if (options?.scene) {
    collectVisibleLightsFromRoot(options.scene, candidates, seen, layers);
    return candidates;
  }

  const visitedRoots = new Set<Object3D>();
  for (let i = 0; i < excludedLights.length; i++) {
    const light = excludedLights[i];
    if (light.visible === false) continue;
    if (light.parent) {
      const root = findScopeRoot(light);
      if (!visitedRoots.has(root)) {
        visitedRoots.add(root);
        collectVisibleLightsFromRoot(root, candidates, seen, layers);
      }
    } else if (matchesLightLayers(light, layers) && !seen.has(light)) {
      seen.add(light);
      candidates.push(light);
    }
  }

  return candidates;
}

export function resolveExcludedLightIndices(
  excludedLights: readonly Light[],
  scope?: LightExclusionScope,
): LightExclusionIndices {
  const normalizedExcluded = normalizeLights(excludedLights);
  if (normalizedExcluded.length === 0) {
    return { directional: [], point: [], spot: [] };
  }

  const options = normalizeScope(scope);
  const excludedSet = new Set<Light>(normalizedExcluded);
  const candidates = collectCandidateLights(normalizedExcluded, options);
  const sorted = candidates.slice().sort(compareLightsThreeOrder);

  const directional: number[] = [];
  const point: number[] = [];
  const spot: number[] = [];

  let dirIndex = 0;
  let pointIndex = 0;
  let spotIndex = 0;

  for (let i = 0; i < sorted.length; i++) {
    const light = sorted[i];
    const bucket = getLightBucket(light);
    if (bucket === 'directional') {
      if (excludedSet.has(light)) directional.push(dirIndex);
      dirIndex++;
    } else if (bucket === 'point') {
      if (excludedSet.has(light)) point.push(pointIndex);
      pointIndex++;
    } else if (bucket === 'spot') {
      if (excludedSet.has(light)) spot.push(spotIndex);
      spotIndex++;
    }
  }

  return { directional, point, spot };
}

function hasActiveExclusions(indices: LightExclusionIndices): boolean {
  return indices.directional.length > 0 || indices.point.length > 0 || indices.spot.length > 0;
}

export function formatLightExclusionCacheKey(indices: LightExclusionIndices): string {
  if (!hasActiveExclusions(indices)) return '';
  return `light-exclusion:d=${indices.directional.join(',')}|p=${indices.point.join(',')}|s=${indices.spot.join(',')}`;
}

function buildMaskStartBlock(tag: 'POINT' | 'SPOT' | 'DIR', indices: readonly number[]): string {
  const condition = indices.map(index => `UNROLLED_LOOP_INDEX == ${index}`).join(' || ');
  return [
    `\t\t/* BEGIN_LIGHT_EXCLUSION_${tag} */`,
    `\t\t#if ( ${condition} )`,
    '\t\tdirectLight.color *= 0.0;',
    '\t\tdirectLight.visible = false;',
    '\t\t#endif',
    `\t\t#if !( ${condition} )`,
    `\t\t/* END_LIGHT_EXCLUSION_${tag} */`,
  ].join('\n');
}

function buildMaskEndBlock(tag: 'POINT' | 'SPOT' | 'DIR'): string {
  return [
    `\t\t/* BEGIN_LIGHT_EXCLUSION_${tag}_END */`,
    '\t\t#endif',
    `\t\t/* END_LIGHT_EXCLUSION_${tag}_END */`,
  ].join('\n');
}

function patchBucketLoop(
  source: string,
  anchor: string,
  tag: 'POINT' | 'SPOT' | 'DIR',
  indices: readonly number[],
): string {
  const anchorIndex = source.indexOf(anchor);
  if (anchorIndex === -1) return source;

  const afterAnchor = anchorIndex + anchor.length;
  const loopEndIndex = source.indexOf('#pragma unroll_loop_end', afterAnchor);
  const reDirectIndex = source.indexOf(RE_DIRECT_CALL, afterAnchor);
  const startBlock = buildMaskStartBlock(tag, indices);
  const endBlock = buildMaskEndBlock(tag);

  if (reDirectIndex !== -1 && (loopEndIndex === -1 || reDirectIndex < loopEndIndex)) {
    const afterReDirect = reDirectIndex + RE_DIRECT_CALL.length;
    return (
      source.slice(0, afterAnchor) +
      '\n' +
      startBlock +
      source.slice(afterAnchor, afterReDirect) +
      '\n' +
      endBlock +
      source.slice(afterReDirect)
    );
  }

  return (
    source.slice(0, afterAnchor) +
    '\n' +
    startBlock +
    '\n' +
    endBlock +
    source.slice(afterAnchor)
  );
}

export function patchLightExclusionShader(
  fragmentShader: string,
  indices: LightExclusionIndices,
): string {
  const stripped = fragmentShader.replace(PRIOR_PATCH_PATTERN, '');
  if (!hasActiveExclusions(indices)) {
    return stripped;
  }

  let source = stripped.includes('#include <lights_fragment_begin>')
    ? stripped.replace('#include <lights_fragment_begin>', ShaderChunk.lights_fragment_begin)
    : stripped;

  if (indices.point.length > 0) {
    source = patchBucketLoop(source, POINT_ANCHOR, 'POINT', indices.point);
  }
  if (indices.spot.length > 0) {
    source = patchBucketLoop(source, SPOT_ANCHOR, 'SPOT', indices.spot);
  }
  if (indices.directional.length > 0) {
    source = patchBucketLoop(source, DIR_ANCHOR, 'DIR', indices.directional);
  }

  return source;
}

function computeCombinedCacheKey(material: SupportedMaterial, state: ExclusionState): string {
  const indices = resolveExcludedLightIndices(state.lights, state.options);
  const exclusionKey = formatLightExclusionCacheKey(indices);
  const hasCustomOnBeforeCompile =
    state.baseOnBeforeCompile !== Material.prototype.onBeforeCompile;
  const hasCustomCacheKey =
    state.baseCustomProgramCacheKey !== Material.prototype.customProgramCacheKey;
  if (!hasCustomOnBeforeCompile && !hasCustomCacheKey) {
    return exclusionKey;
  }
  const baseKey = hasCustomCacheKey
    ? state.baseCustomProgramCacheKey.call(material)
    : state.baseOnBeforeCompile.toString();
  return exclusionKey ? `${baseKey}|${exclusionKey}` : baseKey;
}

export function clearLightExclusion<T extends Material = SupportedMaterial>(material: T): T {
  assertSupportedMaterial(material);
  const target: SupportedMaterial = material;
  const state = exclusionStates.get(target);
  if (!state) return material;

  target.onBeforeCompile = state.baseOnBeforeCompile;
  target.customProgramCacheKey = state.baseCustomProgramCacheKey;
  target.clone = state.baseClone;
  target.copy = state.baseCopy;
  exclusionStates.delete(target);
  target.needsUpdate = true;
  return material;
}

export function refreshLightExclusion<T extends Material = SupportedMaterial>(material: T): T {
  assertSupportedMaterial(material);
  const target: SupportedMaterial = material;
  const state = exclusionStates.get(target);
  if (!state) return material;

  state.lastKey = computeCombinedCacheKey(target, state);
  target.needsUpdate = true;
  return material;
}

export function getExcludedLights(material: Material): readonly SupportedLight[] {
  assertSupportedMaterial(material);
  const state = exclusionStates.get(material);
  return state ? [...state.lights] : [];
}

export function excludeLights<T extends Material = SupportedMaterial>(
  material: T,
  lights: readonly Light[],
  scope?: LightExclusionScope,
): T {
  assertSupportedMaterial(material);
  const target: SupportedMaterial = material;
  const uniqueLights = normalizeLights(lights);
  const options = normalizeScope(scope);

  if (uniqueLights.length === 0) {
    return clearLightExclusion(material);
  }

  const existing = exclusionStates.get(target);
  if (existing) {
    existing.lights = uniqueLights;
    existing.options = options;
    const nextKey = computeCombinedCacheKey(target, existing);
    if (nextKey !== existing.lastKey) {
      existing.lastKey = nextKey;
      target.needsUpdate = true;
    }
    return material;
  }

  const state: ExclusionState = {
    lights: uniqueLights,
    options,
    baseOnBeforeCompile: target.onBeforeCompile,
    baseCustomProgramCacheKey: target.customProgramCacheKey,
    baseClone: target.clone,
    baseCopy: target.copy,
    lastKey: '',
  };

  state.lastKey = computeCombinedCacheKey(target, state);
  exclusionStates.set(target, state);

  target.onBeforeCompile = function onBeforeCompileLightExclusion(
    shader: WebGLProgramParametersWithUniforms,
    renderer: WebGLRenderer,
  ): void {
    state.baseOnBeforeCompile.call(this, shader, renderer);
    const indices = resolveExcludedLightIndices(state.lights, state.options);
    shader.fragmentShader = patchLightExclusionShader(shader.fragmentShader, indices);
  };

  target.customProgramCacheKey = function customProgramCacheKeyLightExclusion(): string {
    return computeCombinedCacheKey(this as SupportedMaterial, state);
  };

  target.clone = function cloneWithLightExclusion(this: SupportedMaterial) {
    const cloned = state.baseClone.call(this);
    cloned.onBeforeCompile = state.baseOnBeforeCompile;
    cloned.customProgramCacheKey = state.baseCustomProgramCacheKey;
    return excludeLights(cloned, state.lights, state.options);
  };

  target.copy = function copyWithLightExclusion(this: SupportedMaterial, source: Material) {
    state.baseCopy.call(this, source);
    if (isSupportedMaterial(source)) {
      const sourceState = exclusionStates.get(source);
      if (sourceState) {
        this.onBeforeCompile = sourceState.baseOnBeforeCompile;
        this.customProgramCacheKey = sourceState.baseCustomProgramCacheKey;
        this.clone = sourceState.baseClone;
        this.copy = sourceState.baseCopy;
        exclusionStates.delete(this);
        return excludeLights(this, sourceState.lights, sourceState.options);
      }
    }
    return clearLightExclusion(this);
  };

  target.needsUpdate = true;
  return material;
}

export const applyLightExclusion = excludeLights;
