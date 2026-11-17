import { describe, expect, it, vi } from 'vitest';
import {
  AmbientLight,
  DirectionalLight,
  Group,
  HemisphereLight,
  Layers,
  Material,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshPhongMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PointLight,
  PointsMaterial,
  RectAreaLight,
  Scene,
  ShaderChunk,
  ShaderLib,
  ShaderMaterial,
  SpotLight,
  Texture,
  type Light,
  type WebGLProgramParametersWithUniforms,
  type WebGLRenderer,
} from 'three';
import {
  applyLightExclusion,
  clearLightExclusion,
  compareLightsThreeOrder,
  excludeLights,
  formatLightExclusionCacheKey,
  getExcludedLights,
  isSupportedMaterial,
  patchLightExclusionShader,
  refreshLightExclusion,
  resolveExcludedLightIndices,
} from '../../src/experience/shared/light-exclusion';

function createShaderParams(kind: 'standard' | 'physical' = 'standard'): WebGLProgramParametersWithUniforms {
  const lib = ShaderLib[kind];
  return {
    vertexShader: lib.vertexShader,
    fragmentShader: lib.fragmentShader,
    uniforms: {},
  } as unknown as WebGLProgramParametersWithUniforms;
}

/** Mirrors `replaceLightNums` + `unrollLoops` from Three.js 0.187 `WebGLProgram.js`. */
function simulateThreeUnroll(
  fragmentShader: string,
  counts: { dir?: number; point?: number; spot?: number },
): string {
  const replaced = fragmentShader
    .replace(/NUM_DIR_LIGHTS/g, String(counts.dir ?? 0))
    .replace(/NUM_POINT_LIGHTS/g, String(counts.point ?? 0))
    .replace(/NUM_SPOT_LIGHTS/g, String(counts.spot ?? 0));

  const unrollPattern =
    /#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*\{([\s\S]+?)\}\s+#pragma unroll_loop_end/g;

  return replaced.replace(unrollPattern, (_match, start: string, end: string, snippet: string) => {
    let out = '';
    for (let i = Number.parseInt(start, 10); i < Number.parseInt(end, 10); i++) {
      out += snippet
        .replace(/\[\s*i\s*\]/g, `[ ${i} ]`)
        .replace(/UNROLLED_LOOP_INDEX/g, String(i));
    }
    return out;
  });
}

const mockRenderer = {} as WebGLRenderer;

describe('light-exclusion shader string transform', () => {
  it('patches directional, point, and spot lights on MeshStandardMaterial and MeshPhysicalMaterial and wraps post-info body in #if !(...)', () => {
    const scene = new Scene();
    const dir0 = new DirectionalLight(0xffffff, 1);
    const dir1 = new DirectionalLight(0xffaa00, 2);
    const point0 = new PointLight(0x00ff88, 1);
    const spot0 = new SpotLight(0xffffff, 1);
    const spot1 = new SpotLight(0x88aaff, 1);
    scene.add(dir0, dir1, point0, spot0, spot1);

    for (const material of [new MeshStandardMaterial(), new MeshPhysicalMaterial()]) {
      excludeLights(material, [dir1, point0, spot1]);
      const shader = createShaderParams(
        material instanceof MeshPhysicalMaterial ? 'physical' : 'standard',
      );
      material.onBeforeCompile(shader, mockRenderer);

      expect(shader.fragmentShader).not.toContain('#include <lights_fragment_begin>');
      expect(shader.fragmentShader).toContain('/* BEGIN_LIGHT_EXCLUSION_DIR */');
      expect(shader.fragmentShader).toContain('#if ( UNROLLED_LOOP_INDEX == 1 )');
      expect(shader.fragmentShader).toContain('#if !( UNROLLED_LOOP_INDEX == 1 )');
      expect(shader.fragmentShader).toContain('/* BEGIN_LIGHT_EXCLUSION_DIR_END */');
      expect(shader.fragmentShader).toContain('/* BEGIN_LIGHT_EXCLUSION_POINT */');
      expect(shader.fragmentShader).toContain('#if ( UNROLLED_LOOP_INDEX == 0 )');
      expect(shader.fragmentShader).toContain('#if !( UNROLLED_LOOP_INDEX == 0 )');
      expect(shader.fragmentShader).toContain('/* BEGIN_LIGHT_EXCLUSION_POINT_END */');
      expect(shader.fragmentShader).toContain('/* BEGIN_LIGHT_EXCLUSION_SPOT */');
      expect(shader.fragmentShader).toContain('/* BEGIN_LIGHT_EXCLUSION_SPOT_END */');
      expect(shader.fragmentShader).toContain('directLight.color *= 0.0;');
      expect(shader.fragmentShader).toContain('directLight.visible = false;');

      const unrolled = simulateThreeUnroll(shader.fragmentShader, { dir: 2, point: 1, spot: 2 });
      expect(unrolled).toMatch(
        /directionalLight = directionalLights\[ 0 \];\s+getDirectionalLightInfo\( directionalLight, directLight \);\s+\/\* BEGIN_LIGHT_EXCLUSION_DIR \*\/\s+#if \( 0 == 1 \)\s+directLight\.color \*= 0\.0;\s+directLight\.visible = false;\s+#endif\s+#if !\( 0 == 1 \)\s+\/\* END_LIGHT_EXCLUSION_DIR \*\/[\s\S]*?RE_Direct\([^;]+\);\s+\/\* BEGIN_LIGHT_EXCLUSION_DIR_END \*\/\s+#endif\s+\/\* END_LIGHT_EXCLUSION_DIR_END \*\//,
      );
      expect(unrolled).toMatch(
        /directionalLight = directionalLights\[ 1 \];\s+getDirectionalLightInfo\( directionalLight, directLight \);\s+\/\* BEGIN_LIGHT_EXCLUSION_DIR \*\/\s+#if \( 1 == 1 \)\s+directLight\.color \*= 0\.0;\s+directLight\.visible = false;\s+#endif\s+#if !\( 1 == 1 \)\s+\/\* END_LIGHT_EXCLUSION_DIR \*\/[\s\S]*?RE_Direct\([^;]+\);\s+\/\* BEGIN_LIGHT_EXCLUSION_DIR_END \*\/\s+#endif\s+\/\* END_LIGHT_EXCLUSION_DIR_END \*\//,
      );
      expect(unrolled).toMatch(
        /pointLight = pointLights\[ 0 \];\s+getPointLightInfo\( pointLight, geometryPosition, directLight \);\s+\/\* BEGIN_LIGHT_EXCLUSION_POINT \*\/\s+#if \( 0 == 0 \)\s+directLight\.color \*= 0\.0;\s+directLight\.visible = false;\s+#endif\s+#if !\( 0 == 0 \)/,
      );
      expect(unrolled).toMatch(
        /spotLight = spotLights\[ 1 \];\s+getSpotLightInfo\( spotLight, geometryPosition, directLight \);\s+\/\* BEGIN_LIGHT_EXCLUSION_SPOT \*\/\s+#if \( 1 == 1 \)\s+directLight\.color \*= 0\.0;\s+directLight\.visible = false;\s+#endif\s+#if !\( 1 == 1 \)\s+\/\* END_LIGHT_EXCLUSION_SPOT \*\/[\s\S]*?spotColor = texture2D\([\s\S]*?RE_Direct\([^;]+\);\s+\/\* BEGIN_LIGHT_EXCLUSION_SPOT_END \*\/\s+#endif\s+\/\* END_LIGHT_EXCLUSION_SPOT_END \*\//,
      );
      material.dispose();
    }
  });

  it('supports multiple excluded lights of the same type and only patches targeted light buckets', () => {
    const scene = new Scene();
    const d0 = new DirectionalLight();
    const d1 = new DirectionalLight();
    const d2 = new DirectionalLight();
    scene.add(d0, d1, d2);

    const material = new MeshStandardMaterial();
    applyLightExclusion(material, [d0, d2]);

    const shader = createShaderParams();
    material.onBeforeCompile(shader, mockRenderer);

    expect(shader.fragmentShader).toContain('#if ( UNROLLED_LOOP_INDEX == 0 || UNROLLED_LOOP_INDEX == 2 )');
    expect(shader.fragmentShader).toContain('#if !( UNROLLED_LOOP_INDEX == 0 || UNROLLED_LOOP_INDEX == 2 )');
    expect(shader.fragmentShader).toContain('/* BEGIN_LIGHT_EXCLUSION_DIR */');
    expect(shader.fragmentShader).toContain('/* BEGIN_LIGHT_EXCLUSION_DIR_END */');
    expect(shader.fragmentShader).not.toContain('/* BEGIN_LIGHT_EXCLUSION_POINT */');
    expect(shader.fragmentShader).not.toContain('/* BEGIN_LIGHT_EXCLUSION_SPOT */');
    material.dispose();
  });

  it('excludes lights inside hidden groups/ancestors from index counts so other active scene lights are never hijacked', () => {
    const scene = new Scene();
    const activeSceneGroup = new Group();
    activeSceneGroup.visible = true;
    const activePoint = new PointLight(0xffffff, 1);
    const activeDir = new DirectionalLight(0xffffff, 1);
    activeSceneGroup.add(activePoint, activeDir);

    const hiddenS06Group = new Group();
    hiddenS06Group.visible = false;
    const helixKey = new PointLight(0x1fc98a, 3);
    const platformGlow = new PointLight(0x1fc98a, 1.5);
    hiddenS06Group.add(helixKey, platformGlow);

    scene.add(activeSceneGroup, hiddenS06Group);

    // Without an explicit scene argument, findScopeRoot climbs to `scene` and prunes `hiddenS06Group`
    expect(resolveExcludedLightIndices([helixKey])).toEqual({
      directional: [],
      point: [],
      spot: [],
    });

    const floorMaterial = excludeLights(new MeshStandardMaterial(), [helixKey]);
    expect(floorMaterial.customProgramCacheKey()).toBe('');

    const shaderWhileHidden = createShaderParams('standard');
    floorMaterial.onBeforeCompile(shaderWhileHidden, mockRenderer);
    expect(shaderWhileHidden.fragmentShader).not.toContain('BEGIN_LIGHT_EXCLUSION_POINT');

    // Detached hidden group also resolves to empty indices
    const detachedHiddenGroup = new Group();
    detachedHiddenGroup.visible = false;
    const detachedLight = new PointLight();
    detachedHiddenGroup.add(detachedLight);
    expect(resolveExcludedLightIndices([detachedLight])).toEqual({
      directional: [],
      point: [],
      spot: [],
    });

    floorMaterial.dispose();
  });

  it('models S06 (helix key excluded from floor, including castShadow shift) and S07 (sun excludes N/discs, fill excludes tree) in a Scene hierarchy', () => {
    const scene = new Scene();

    // S06 active in Scene: helix key (PointLight) must not light the floor, platform glow (PointLight) still does.
    const s06Group = new Group();
    s06Group.visible = true;
    const helixKey = new PointLight(0x1fc98a, 3);
    const platformGlow = new PointLight(0x1fc98a, 1.5);
    s06Group.add(helixKey, platformGlow);

    // S07 starts hidden while S06 is active
    const s07Group = new Group();
    s07Group.visible = false;
    const sun = new DirectionalLight(0xffb478, 2.2);
    const fill = new DirectionalLight(0x88b4ff, 0.9);
    s07Group.add(sun, fill);

    scene.add(s06Group, s07Group);

    const floorMaterial = excludeLights(new MeshStandardMaterial(), [helixKey]);
    expect(resolveExcludedLightIndices([helixKey])).toEqual({
      directional: [],
      point: [0],
      spot: [],
    });

    const floorShader = createShaderParams('standard');
    floorMaterial.onBeforeCompile(floorShader, mockRenderer);
    const unrolledFloor = simulateThreeUnroll(floorShader.fragmentShader, { point: 2 });
    // pointLights[0] (helixKey) is excluded; pointLights[1] (platformGlow) is preserved
    expect(unrolledFloor).toMatch(
      /pointLight = pointLights\[ 0 \];\s+getPointLightInfo\( pointLight, geometryPosition, directLight \);\s+\/\* BEGIN_LIGHT_EXCLUSION_POINT \*\/\s+#if \( 0 == 0 \)\s+directLight\.color \*= 0\.0;\s+directLight\.visible = false;\s+#endif\s+#if !\( 0 == 0 \)/,
    );
    expect(unrolledFloor).toMatch(
      /pointLight = pointLights\[ 1 \];\s+getPointLightInfo\( pointLight, geometryPosition, directLight \);\s+\/\* BEGIN_LIGHT_EXCLUSION_POINT \*\/\s+#if \( 1 == 0 \)\s+directLight\.color \*= 0\.0;\s+directLight\.visible = false;\s+#endif\s+#if !\( 1 == 0 \)/,
    );

    // Enabling castShadow on platformGlow sorts it ahead of helixKey (point[0] = platformGlow, point[1] = helixKey)
    platformGlow.castShadow = true;
    refreshLightExclusion(floorMaterial);
    expect(resolveExcludedLightIndices([helixKey])).toEqual({
      directional: [],
      point: [1],
      spot: [],
    });
    expect(floorMaterial.customProgramCacheKey()).toBe('light-exclusion:d=|p=1|s=');

    const floorShaderShifted = createShaderParams('standard');
    floorMaterial.onBeforeCompile(floorShaderShifted, mockRenderer);
    const unrolledFloorShifted = simulateThreeUnroll(floorShaderShifted.fragmentShader, { point: 2 });
    expect(unrolledFloorShifted).toMatch(
      /pointLight = pointLights\[ 0 \];\s+getPointLightInfo\( pointLight, geometryPosition, directLight \);\s+\/\* BEGIN_LIGHT_EXCLUSION_POINT \*\/\s+#if \( 0 == 1 \)/,
    );
    expect(unrolledFloorShifted).toMatch(
      /pointLight = pointLights\[ 1 \];\s+getPointLightInfo\( pointLight, geometryPosition, directLight \);\s+\/\* BEGIN_LIGHT_EXCLUSION_POINT \*\/\s+#if \( 1 == 1 \)/,
    );

    // Transition to S07: s06Group hides, s07Group becomes visible
    s06Group.visible = false;
    s07Group.visible = true;

    const discMaterial = excludeLights(new MeshPhysicalMaterial(), [sun]);
    const treeMaterial = excludeLights(new MeshStandardMaterial(), [fill]);

    const discShader = createShaderParams('physical');
    const treeShader = createShaderParams('standard');
    discMaterial.onBeforeCompile(discShader, mockRenderer);
    treeMaterial.onBeforeCompile(treeShader, mockRenderer);

    expect(discShader.fragmentShader).toContain('#if ( UNROLLED_LOOP_INDEX == 0 )');
    expect(treeShader.fragmentShader).toContain('#if ( UNROLLED_LOOP_INDEX == 1 )');
    expect(discMaterial.customProgramCacheKey()).not.toBe(treeMaterial.customProgramCacheKey());

    const unrolledDisc = simulateThreeUnroll(discShader.fragmentShader, { dir: 2 });
    // On discShader: sun (0) is excluded, fill (1) is preserved
    expect(unrolledDisc).toMatch(
      /directionalLight = directionalLights\[ 0 \];\s+getDirectionalLightInfo\( directionalLight, directLight \);\s+\/\* BEGIN_LIGHT_EXCLUSION_DIR \*\/\s+#if \( 0 == 0 \)\s+directLight\.color \*= 0\.0;\s+directLight\.visible = false;\s+#endif\s+#if !\( 0 == 0 \)/,
    );
    expect(unrolledDisc).toMatch(
      /directionalLight = directionalLights\[ 1 \];\s+getDirectionalLightInfo\( directionalLight, directLight \);\s+\/\* BEGIN_LIGHT_EXCLUSION_DIR \*\/\s+#if \( 1 == 0 \)\s+directLight\.color \*= 0\.0;\s+directLight\.visible = false;\s+#endif\s+#if !\( 1 == 0 \)/,
    );

    const unrolledTree = simulateThreeUnroll(treeShader.fragmentShader, { dir: 2 });
    // On treeShader: sun (0) is preserved, fill (1) is excluded
    expect(unrolledTree).toMatch(
      /directionalLight = directionalLights\[ 0 \];\s+getDirectionalLightInfo\( directionalLight, directLight \);\s+\/\* BEGIN_LIGHT_EXCLUSION_DIR \*\/\s+#if \( 0 == 1 \)\s+directLight\.color \*= 0\.0;\s+directLight\.visible = false;\s+#endif\s+#if !\( 0 == 1 \)/,
    );
    expect(unrolledTree).toMatch(
      /directionalLight = directionalLights\[ 1 \];\s+getDirectionalLightInfo\( directionalLight, directLight \);\s+\/\* BEGIN_LIGHT_EXCLUSION_DIR \*\/\s+#if \( 1 == 1 \)\s+directLight\.color \*= 0\.0;\s+directLight\.visible = false;\s+#endif\s+#if !\( 1 == 1 \)/,
    );

    floorMaterial.dispose();
    discMaterial.dispose();
    treeMaterial.dispose();
  });

  it('orders shadow-casting and map-texturing lights first to match WebGLLights.setup', () => {
    const scene = new Scene();
    const unshadowedDir = new DirectionalLight();
    const shadowedDir = new DirectionalLight();
    shadowedDir.castShadow = true;

    const plainSpot = new SpotLight();
    const mappedSpot = new SpotLight();
    mappedSpot.map = new Texture();
    const shadowedSpot = new SpotLight();
    shadowedSpot.castShadow = true;
    const shadowedMappedSpot = new SpotLight();
    shadowedMappedSpot.castShadow = true;
    shadowedMappedSpot.map = new Texture();

    scene.add(unshadowedDir, shadowedDir, plainSpot, mappedSpot, shadowedSpot, shadowedMappedSpot);

    expect(compareLightsThreeOrder(shadowedDir, unshadowedDir)).toBeLessThan(0);
    // shadowedDir becomes directional[0], unshadowedDir becomes directional[1]
    expect(resolveExcludedLightIndices([unshadowedDir])).toEqual({
      directional: [1],
      point: [],
      spot: [],
    });

    // Spot order: shadowedMappedSpot (0), shadowedSpot (1), mappedSpot (2), plainSpot (3)
    expect(resolveExcludedLightIndices([mappedSpot, plainSpot])).toEqual({
      directional: [],
      point: [],
      spot: [2, 3],
    });

    mappedSpot.map.dispose();
    shadowedMappedSpot.map.dispose();
  });

  it('filters candidate lights by optional camera layers on the Light itself (matching WebGLRenderer.projectObject)', () => {
    const scene = new Scene();
    const parentGroupOnLayer2 = new Group();
    parentGroupOnLayer2.layers.set(2); // projectObject does NOT prune child traversal on group layer mismatch

    const culledDirOnLayer1 = new DirectionalLight();
    culledDirOnLayer1.layers.set(1);

    const activeDir0 = new DirectionalLight();
    activeDir0.layers.set(0);

    const activeDir1 = new DirectionalLight();
    activeDir1.layers.set(0);

    parentGroupOnLayer2.add(culledDirOnLayer1, activeDir0, activeDir1);
    scene.add(parentGroupOnLayer2);

    const cameraLayers = new Layers();
    cameraLayers.set(0);

    // Without layers filter, culledDirOnLayer1 is counted at index 0, shifting activeDir1 to index 2
    expect(resolveExcludedLightIndices([activeDir1])).toEqual({
      directional: [2],
      point: [],
      spot: [],
    });

    // With layers filter matching camera (layer 0), culledDirOnLayer1 is skipped so activeDir1 is at index 1
    expect(resolveExcludedLightIndices([activeDir1], { layers: cameraLayers })).toEqual({
      directional: [1],
      point: [],
      spot: [],
    });

    // Excluded light that itself fails the layer test resolves to empty indices
    expect(resolveExcludedLightIndices([culledDirOnLayer1], { layers: cameraLayers })).toEqual({
      directional: [],
      point: [],
      spot: [],
    });
  });

  it('patches pre-expanded lights_fragment_begin chunks directly', () => {
    const indices = { directional: [0], point: [1], spot: [] };
    const patched = patchLightExclusionShader(ShaderChunk.lights_fragment_begin, indices);
    expect(patched).toContain('/* BEGIN_LIGHT_EXCLUSION_DIR */');
    expect(patched).toContain('/* BEGIN_LIGHT_EXCLUSION_DIR_END */');
    expect(patched).toContain('/* BEGIN_LIGHT_EXCLUSION_POINT */');
    expect(patched).toContain('/* BEGIN_LIGHT_EXCLUSION_POINT_END */');
    expect(patched).not.toContain('/* BEGIN_LIGHT_EXCLUSION_SPOT */');
  });
});

describe('customProgramCacheKey, material clone, copy, refresh, and shader recompile', () => {
  it('generates stable cache keys and shares keys only across identical exclusion sets', () => {
    const scene = new Scene();
    const d0 = new DirectionalLight();
    const d1 = new DirectionalLight();
    const p0 = new PointLight();
    scene.add(d0, d1, p0);

    const matA1 = excludeLights(new MeshStandardMaterial(), [d0, p0]);
    const matA2 = excludeLights(new MeshStandardMaterial(), [d0, p0]);
    const matB = excludeLights(new MeshStandardMaterial(), [d1, p0]);

    const keyA1 = matA1.customProgramCacheKey();
    expect(keyA1).toBe('light-exclusion:d=0|p=0|s=');
    expect(matA1.customProgramCacheKey()).toBe(keyA1);
    expect(matA2.customProgramCacheKey()).toBe(keyA1);
    expect(matB.customProgramCacheKey()).toBe('light-exclusion:d=1|p=0|s=');
    expect(matB.customProgramCacheKey()).not.toBe(keyA1);

    matA1.dispose();
    matA2.dispose();
    matB.dispose();
  });

  it('survives material.clone(), chained clones, material.copy(), and shader recompiles', () => {
    const scene = new Scene();
    const dir0 = new DirectionalLight();
    const dir1 = new DirectionalLight();
    scene.add(dir0, dir1);

    const original = new MeshPhysicalMaterial({ roughness: 0.35, clearcoat: 0.8 });
    excludeLights(original, [dir1]);

    const cloned = original.clone();
    const clonedTwice = cloned.clone();

    expect(cloned).not.toBe(original);
    expect(cloned.customProgramCacheKey()).toBe(original.customProgramCacheKey());
    expect(clonedTwice.customProgramCacheKey()).toBe(original.customProgramCacheKey());
    expect(getExcludedLights(cloned)).toEqual([dir1]);
    expect(getExcludedLights(clonedTwice)).toEqual([dir1]);

    // Simulate multiple shader compiles / recompiles on original and cloned materials
    for (const mat of [original, cloned, clonedTwice]) {
      const firstCompile = createShaderParams('physical');
      mat.onBeforeCompile(firstCompile, mockRenderer);
      mat.needsUpdate = true;
      const recompile = createShaderParams('physical');
      mat.onBeforeCompile(recompile, mockRenderer);

      expect(firstCompile.fragmentShader).toBe(recompile.fragmentShader);
      expect(recompile.fragmentShader).toContain('#if ( UNROLLED_LOOP_INDEX == 1 )');
    }

    // Copying from another patched material updates exclusions; copying from unpatched clears them
    const otherPatched = excludeLights(new MeshPhysicalMaterial(), [dir0]);
    clonedTwice.copy(otherPatched);
    expect(getExcludedLights(clonedTwice)).toEqual([dir0]);
    expect(clonedTwice.customProgramCacheKey()).toBe(otherPatched.customProgramCacheKey());

    const unpatched = new MeshPhysicalMaterial();
    clonedTwice.copy(unpatched);
    expect(getExcludedLights(clonedTwice)).toEqual([]);
    expect(clonedTwice.customProgramCacheKey()).toBe(unpatched.customProgramCacheKey());

    otherPatched.dispose();
    original.dispose();
    cloned.dispose();
    clonedTwice.dispose();
    unpatched.dispose();
  });

  it('preserves pre-existing custom onBeforeCompile and customProgramCacheKey hooks', () => {
    const dir = new DirectionalLight();
    const material = new MeshStandardMaterial();
    const priorHook = vi.fn((shader: WebGLProgramParametersWithUniforms) => {
      shader.fragmentShader = '// custom-header\n' + shader.fragmentShader;
    });
    material.onBeforeCompile = priorHook;
    material.customProgramCacheKey = () => 'custom-base-key';

    excludeLights(material, [dir]);
    expect(material.customProgramCacheKey()).toBe('custom-base-key|light-exclusion:d=0|p=|s=');

    const shader = createShaderParams();
    material.onBeforeCompile(shader, mockRenderer);
    expect(priorHook).toHaveBeenCalledOnce();
    expect(shader.fragmentShader.startsWith('// custom-header\n')).toBe(true);
    expect(shader.fragmentShader).toContain('/* BEGIN_LIGHT_EXCLUSION_DIR */');

    const cloned = material.clone();
    expect(cloned.customProgramCacheKey()).toBe('custom-base-key|light-exclusion:d=0|p=|s=');

    clearLightExclusion(material);
    expect(material.onBeforeCompile).toBe(priorHook);
    expect(material.customProgramCacheKey()).toBe('custom-base-key');

    material.dispose();
    cloned.dispose();
  });

  it('uses the original onBeforeCompile.toString() when customProgramCacheKey is left at Material.prototype.customProgramCacheKey', () => {
    const scene = new Scene();
    const dir = new DirectionalLight();
    scene.add(dir);

    const hookA = function customHookA(shader: WebGLProgramParametersWithUniforms) {
      shader.fragmentShader = '// hook-A\n' + shader.fragmentShader;
    };
    const hookB = function customHookB(shader: WebGLProgramParametersWithUniforms) {
      shader.fragmentShader = '// hook-B\n' + shader.fragmentShader;
    };

    const matA = new MeshStandardMaterial();
    matA.onBeforeCompile = hookA;
    const matB = new MeshStandardMaterial();
    matB.onBeforeCompile = hookB;

    // Neither matA nor matB overrides customProgramCacheKey (both use Material.prototype.customProgramCacheKey)
    expect(matA.customProgramCacheKey).toBe(Material.prototype.customProgramCacheKey);
    expect(matB.customProgramCacheKey).toBe(Material.prototype.customProgramCacheKey);

    excludeLights(matA, [dir]);
    excludeLights(matB, [dir]);

    expect(matA.customProgramCacheKey()).toBe(`${hookA.toString()}|light-exclusion:d=0|p=|s=`);
    expect(matB.customProgramCacheKey()).toBe(`${hookB.toString()}|light-exclusion:d=0|p=|s=`);
    expect(matA.customProgramCacheKey()).not.toBe(matB.customProgramCacheKey());

    const clonedA = matA.clone();
    expect(clonedA.customProgramCacheKey()).toBe(`${hookA.toString()}|light-exclusion:d=0|p=|s=`);

    clearLightExclusion(matA);
    expect(matA.onBeforeCompile).toBe(hookA);
    expect(matA.customProgramCacheKey).toBe(Material.prototype.customProgramCacheKey);
    expect(matA.customProgramCacheKey()).toBe(hookA.toString());

    matA.dispose();
    matB.dispose();
    clonedA.dispose();
  });

  it('forces a recompile via refreshLightExclusion(material) after same-count visibility, shadow, or child-order swaps', () => {
    const scene = new Scene();
    const p0 = new PointLight();
    const target = new PointLight();
    const p2 = new PointLight();
    p2.visible = false;
    scene.add(p0, target, p2);

    const material = excludeLights(new MeshStandardMaterial(), [target]);
    // Initially p0 (0) and target (1) are visible -> target is at point[1]
    expect(material.customProgramCacheKey()).toBe('light-exclusion:d=|p=1|s=');
    const versionBeforeSwap = material.version;

    // Same-count visibility swap: hide p0 before target, show p2 after target -> total visible point lights stays 2,
    // but target shifts from point[1] to point[0].
    p0.visible = false;
    p2.visible = true;

    refreshLightExclusion(material);
    expect(material.version).toBeGreaterThan(versionBeforeSwap);
    expect(material.customProgramCacheKey()).toBe('light-exclusion:d=|p=0|s=');

    const shaderAfterSwap = createShaderParams();
    material.onBeforeCompile(shaderAfterSwap, mockRenderer);
    expect(shaderAfterSwap.fragmentShader).toContain('#if ( UNROLLED_LOOP_INDEX == 0 )');

    // Unpatched material is a safe no-op in refreshLightExclusion
    const unpatched = new MeshStandardMaterial();
    const unpatchedVersion = unpatched.version;
    expect(refreshLightExclusion(unpatched)).toBe(unpatched);
    expect(unpatched.version).toBe(unpatchedVersion);

    material.dispose();
    unpatched.dispose();
  });
});

describe('idempotence and zero-cost empty behavior', () => {
  it('is idempotent when applied multiple times or with duplicate lights in the array', () => {
    const scene = new Scene();
    const dir = new DirectionalLight();
    const point = new PointLight();
    scene.add(dir, point);

    const material = new MeshStandardMaterial();
    excludeLights(material, [dir, point]);
    const versionAfterFirst = material.version;
    const hookAfterFirst = material.onBeforeCompile;
    const keyAfterFirst = material.customProgramCacheKey();

    // Apply again with duplicate entries
    excludeLights(material, [dir, point, dir, point]);
    expect(material.version).toBe(versionAfterFirst);
    expect(material.onBeforeCompile).toBe(hookAfterFirst);
    expect(material.customProgramCacheKey()).toBe(keyAfterFirst);
    expect(getExcludedLights(material)).toEqual([dir, point]);

    // Invoking onBeforeCompile twice on the same shader object is also idempotent
    const shader = createShaderParams();
    material.onBeforeCompile(shader, mockRenderer);
    const once = shader.fragmentShader;
    material.onBeforeCompile(shader, mockRenderer);
    expect(shader.fragmentShader).toBe(once);
    expect(shader.fragmentShader.match(/BEGIN_LIGHT_EXCLUSION_DIR\b/g)?.length).toBe(1);
    expect(shader.fragmentShader.match(/BEGIN_LIGHT_EXCLUSION_DIR_END\b/g)?.length).toBe(1);
    expect(shader.fragmentShader.match(/BEGIN_LIGHT_EXCLUSION_POINT\b/g)?.length).toBe(1);
    expect(shader.fragmentShader.match(/BEGIN_LIGHT_EXCLUSION_POINT_END\b/g)?.length).toBe(1);

    material.dispose();
  });

  it('has zero cost on materials without exclusions and restores all hooks (including copy) when cleared', () => {
    const material = new MeshStandardMaterial();
    const initialVersion = material.version;

    excludeLights(material, []);
    expect(material.version).toBe(initialVersion);
    expect(material.onBeforeCompile).toBe(Material.prototype.onBeforeCompile);
    expect(material.customProgramCacheKey).toBe(Material.prototype.customProgramCacheKey);
    expect(material.clone).toBe(Material.prototype.clone);
    expect(material.copy).toBe(MeshStandardMaterial.prototype.copy);
    expect(formatLightExclusionCacheKey({ directional: [], point: [], spot: [] })).toBe('');
    expect(
      patchLightExclusionShader(ShaderLib.standard.fragmentShader, {
        directional: [],
        point: [],
        spot: [],
      }),
    ).toBe(ShaderLib.standard.fragmentShader);

    // Apply then clear via empty list
    const light = new DirectionalLight();
    excludeLights(material, [light]);
    expect(material.onBeforeCompile).not.toBe(Material.prototype.onBeforeCompile);
    expect(material.copy).not.toBe(MeshStandardMaterial.prototype.copy);

    excludeLights(material, []);
    expect(material.onBeforeCompile).toBe(Material.prototype.onBeforeCompile);
    expect(material.customProgramCacheKey).toBe(Material.prototype.customProgramCacheKey);
    expect(material.clone).toBe(Material.prototype.clone);
    expect(material.copy).toBe(MeshStandardMaterial.prototype.copy);
    expect(getExcludedLights(material)).toEqual([]);

    material.dispose();
  });
});

describe('unsupported material and light types', () => {
  it('rejects unsupported material types with TypeError', () => {
    const light = new DirectionalLight();
    const unsupportedMaterials = [
      new MeshBasicMaterial(),
      new MeshLambertMaterial(),
      new MeshPhongMaterial(),
      new ShaderMaterial(),
      new PointsMaterial(),
    ];

    for (const unsupported of unsupportedMaterials) {
      expect(isSupportedMaterial(unsupported)).toBe(false);
      expect(() => excludeLights(unsupported, [light])).toThrow(TypeError);
      expect(() => applyLightExclusion(unsupported, [light])).toThrow(/MeshStandardMaterial or MeshPhysicalMaterial/);
      expect(() => clearLightExclusion(unsupported)).toThrow(TypeError);
      expect(() => refreshLightExclusion(unsupported)).toThrow(TypeError);
      expect(() => getExcludedLights(unsupported)).toThrow(TypeError);
      unsupported.dispose();
    }

    expect(isSupportedMaterial(null)).toBe(false);
    expect(isSupportedMaterial(undefined)).toBe(false);
    expect(isSupportedMaterial({})).toBe(false);
    expect(() => excludeLights(null as unknown as Material, [light])).toThrow(TypeError);
  });

  it('rejects unsupported light types and non-array light arguments with TypeError', () => {
    const material = new MeshStandardMaterial();
    const unsupportedLights = [
      new AmbientLight(),
      new HemisphereLight(),
      new RectAreaLight(),
    ];

    for (const unsupportedLight of unsupportedLights) {
      expect(() => excludeLights(material, [unsupportedLight])).toThrow(TypeError);
      expect(() => excludeLights(material, [unsupportedLight])).toThrow(
        /DirectionalLight, PointLight, or SpotLight/,
      );
    }

    expect(() => excludeLights(material, null as unknown as Light[])).toThrow(TypeError);
    material.dispose();
  });
});
