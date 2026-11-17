# MO-3a — Per-Material Light-Exclusion Shader Patch Report

## 1. Approach

### How Three.js `0.187.0` Indexes Lights
1. **Collection (`WebGLRenderer.projectObject`)**: During scene projection, Three.js traverses the scene graph in depth-first pre-order, pruning any subtree where `object.visible === false`, and pushes each visible `Light` passing `object.layers.test(camera.layers)` into `lightsArray` (note: parent group `layers` do not prune child traversal).
2. **Sorting & Partitioning (`WebGLLights.setup`)**: Before assigning uniform slots, `lightsArray` is stably sorted with `shadowCastingAndTexturingLightsFirst`:
   ```ts
   (lightB.castShadow ? 2 : 0) - (lightA.castShadow ? 2 : 0) + (lightB.map ? 1 : 0) - (lightA.map ? 1 : 0)
   ```
   The sorted list is then partitioned by light type into `directionalLights[0..NUM_DIR_LIGHTS-1]`, `pointLights[0..NUM_POINT_LIGHTS-1]`, and `spotLights[0..NUM_SPOT_LIGHTS-1]`.
3. **Shader Loop Unrolling (`lights_fragment_begin` + `WebGLProgram.unrollLoops`)**: In `ShaderChunk.lights_fragment_begin`, each light type has a `#pragma unroll_loop_start ... #pragma unroll_loop_end` loop that calls `getPointLightInfo`, `getSpotLightInfo`, or `getDirectionalLightInfo` to populate `IncidentLight directLight`, optionally applies spot-map / shadow-map attenuation, and accumulates radiance via `RE_Direct(...)`. When `WebGLProgram` compiles the shader, `unrollLoops` strips the `for ( int i = 0; ... )` header and replaces `[ i ]` and `UNROLLED_LOOP_INDEX` with the integer literal `0`, `1`, `...` for each iteration.

### Per-Material Patch (`src/experience/shared/light-exclusion/index.ts`)
- **Index Resolution (`resolveExcludedLightIndices`)**: Given the excluded `Light[]` (and an optional scene/light-list/camera-layers scope, defaulting to climbing `light.parent` all the way to the true root), we collect visible lights in depth-first pre-order (pruning any root or subtree with `node.visible === false`, and optionally testing `light.layers.test(options.layers)` on each `Light`), sort them with `compareLightsThreeOrder` (matching `WebGLLights.setup`), and compute each excluded light's 0-based uniform index within its `directional`, `point`, or `spot` bucket.
- **GLSL Transform (`patchLightExclusionShader`)**: Inside `material.onBeforeCompile`, `#include <lights_fragment_begin>` is expanded to `ShaderChunk.lights_fragment_begin`. Immediately after `getPointLightInfo(...)`, `getSpotLightInfo(...)`, and/or `getDirectionalLightInfo(...)`, we inject a preprocessor guard that zeros `directLight` on excluded iterations and wraps the entire post-info body (including `spotLightMap` sampling, `getShadow`/`getPointShadow`, and `RE_Direct(...)`) in `#if !( UNROLLED_LOOP_INDEX == ... )`:
  ```glsl
  /* BEGIN_LIGHT_EXCLUSION_DIR */
  #if ( UNROLLED_LOOP_INDEX == 0 )
  directLight.color *= 0.0;
  directLight.visible = false;
  #endif
  #if !( UNROLLED_LOOP_INDEX == 0 )
  /* END_LIGHT_EXCLUSION_DIR */
  ... (spotLightMap / shadow lookup / RE_Direct) ...
  /* BEGIN_LIGHT_EXCLUSION_DIR_END */
  #endif
  /* END_LIGHT_EXCLUSION_DIR_END */
  ```
  After `WebGLProgram.unrollLoops` substitutes `UNROLLED_LOOP_INDEX` with literal loop indices (`0`, `1`, ...), the GLSL preprocessor evaluates `#if ( k == idx )` and `#if !( k == idx )` at compile time:
  - Non-excluded lights have `#if ( k == idx )` stripped and `#if !( k == idx )` kept (zero runtime instructions added).
  - Excluded lights zero `directLight.color` and `directLight.visible = false`, and strip `spotLightMap` sampling, shadow-map lookups, and `RE_Direct` BRDF evaluation at preprocessor time.
- **Program Cache Key (`customProgramCacheKey`)**: Encodes `light-exclusion:d=...|p=...|s=...` chained with any pre-existing custom cache key (or with `baseOnBeforeCompile.toString()` when a custom `onBeforeCompile` is used with the default `Material.prototype.customProgramCacheKey`).
- **Clone, Copy, Refresh & Idempotence**: State is tracked in a `WeakMap<SupportedMaterial, ExclusionState>`. Instance `clone` and `copy` methods are wrapped so `material.clone()` and `patchedMaterial.copy(source)` preserve or clear exclusions and cache keys. Applying `excludeLights` repeatedly (or calling `onBeforeCompile` multiple times) is idempotent; passing `[]` to an unpatched material is a zero-cost no-op, and passing `[]` (or calling `clearLightExclusion`) on a patched material restores all original hooks (`onBeforeCompile`, `customProgramCacheKey`, `clone`, `copy`). `refreshLightExclusion(material)` recomputes the cache key and sets `material.needsUpdate = true` for same-count light swaps.

---

## 2. Limits

1. **Light Topology Changes & Same-Count Swaps (Add / Remove / Visibility / Shadow / Reorder)**:
   - Adding, removing, or toggling `.visible`, `castShadow`, or `SpotLight.map` on a light of the same type before an excluded light in the sorted order shifts uniform indices `0..N-1`.
   - When light counts or shadow/map counts change, Three.js's `WebGLLights.setup` increments `lights.state.version`, which automatically triggers `WebGLRenderer.getProgram` -> `material.customProgramCacheKey()` and re-resolves the indices from the scene graph.
   - However, **same-count swaps** — swapping `.visible` between two lights of the same type (`a.visible = false; b.visible = true`), swapping `castShadow` or `SpotLight.map` between two lights simultaneously, or reordering `scene.children` while keeping total bucket/shadow/map counts constant — do not increment `lights.state.version`. In those cases, callers must call `refreshLightExclusion(material)` (or re-call `excludeLights(material, lights)` / set `material.needsUpdate = true`).
2. **Camera Layers (`Layers`)**:
   - `WebGLRenderer.projectObject` tests `light.layers.test(camera.layers)` on each `Light` (without pruning child traversal when a parent group's `layers` differ). If a scene uses non-default camera layers to cull lights, pass `{ layers: camera.layers }` in the `scope` options so layer-culled lights do not shift uniform indices.
3. **Copying Into an Unpatched Material (`unpatched.copy(patched)`)**:
   - Because `Material.prototype.copy` is intentionally left untouched so unpatched materials pay zero overhead, calling `unpatchedMaterial.copy(patchedMaterial)` cannot copy exclusion hooks onto `unpatchedMaterial`. Use `patchedMaterial.clone()`, or call `excludeLights(target, getExcludedLights(source))` (whereas `patchedMaterial.copy(source)` is wrapped and updates/clears exclusions).
4. **Shadow Casting by Excluded Meshes**:
   - Skipping the excluded light in the fragment shader prevents it from illuminating or shadowing the patched material, and skips the fragment shadow-map fetch on that material.
   - It does not remove the mesh from the light's shadow-map depth pass if `mesh.castShadow === true` (so the mesh can still cast shadows onto other meshes that do receive the light).
5. **Supported Material & Light Types**:
   - Scoped to `MeshStandardMaterial` and `MeshPhysicalMaterial`, and to `DirectionalLight`, `PointLight`, and `SpotLight` (the light types and material classes used by S06 and S07). Passing unsupported materials or lights throws a descriptive `TypeError`.

---

## 3. Expected GPU Cost

- **Materials without exclusions (`excludeLights(mat, [])` or unpatched)**: **0 GPU cost, 0 CPU cost, 0 extra shader variants** (hooks are untouched).
- **Fragment shader execution cost on patched materials**: **0 extra runtime ALU/branch instructions on non-excluded lights, and net negative GPU cost on excluded lights**. Because `#if ( UNROLLED_LOOP_INDEX == k )` and `#if !( UNROLLED_LOOP_INDEX == k )` are resolved by the GLSL preprocessor after loop unrolling:
  - Non-excluded lights emit identical GLSL to unpatched `MeshStandardMaterial`/`MeshPhysicalMaterial`.
  - Excluded lights strip `spotLightMap` texture sampling, `getShadow` / `getPointShadow` PCF texture lookups, and `RE_Direct` (`BRDF_GGX` / `BRDF_GGX_Clearcoat` / `BRDF_Sheen`) at preprocessor time (leaving only `get*LightInfo` writing to dead `directLight` fields, which the compiler eliminates).
- **Program compilation / state switch cost**: One additional `WebGLProgram` variant per unique `(material properties, d/p/s exclusion signature)` tuple:
  - **S06**: 1 extra program variant (floor material excluding the helix key light).
  - **S07**: 2 extra program variants (N + ear discs sharing `d=0` to exclude sun; tree using `d=1` to exclude fill).
  - Pre-warmed via `renderer.compile` (§2.7) before the scene's first visible frame, avoiding runtime compilation hitches.

---

## 4. Fallback Plan (Plan §2.5)

If shader program variants or scene-graph light-index coupling prove undesirable during MO-3 scene integration or real-device profiling:
- **S06 Floor (helix key exclusion)**: Fall back to a **baked/unlit treatment** (`MeshBasicMaterial` with baked floor lighting/AO map, or `MeshStandardMaterial` with `emissiveMap` + reduced roughness/metalness response and attenuated helix key distance cutoff `PointLight.distance` tuned so falloff reaches 0 before the floor plane).
- **S07 N / Ear Discs & Tree (sun / fill exclusion)**:
  - For the N and ear discs: use an unlit/emissive-driven or custom matcap/envMap-only material so the low sun directional light cannot blow out the rim/disc highlights.
  - For the tree: bake the ambient/sun lighting into vertex colors or a lightmap/baked texture on an unlit material so the camera-left fill light does not flatten the tree silhouette.

---

## 5. Gate Results

- `pnpm lint` (`eslint .`): **PASS** (0 errors, 0 warnings)
- `pnpm typecheck` (`tsc --noEmit`): **PASS** (0 errors)
- `pnpm test` (`vitest run`): **PASS** (37 test files, 315 tests passed, including 16 tests in `tests/unit/light-exclusion.test.ts`)

---

## 6. Review Round 1

1. **MAJOR 1 — Hidden-ancestor scope truncation assigns active uniform indices to lights inside `visible = false` groups**:
   - **Status**: Fixed.
   - **How**: `findScopeRoot` now climbs `while (current.parent) current = current.parent;` to the true scene-graph root without stopping at `visible === false`. `collectVisibleLightsFromRoot` checks `if (node.visible === false) return;` on every node including `root` (and `isHierarchyVisible` checks ancestors when an explicit `options.lights` list is provided), matching `WebGLRenderer.projectObject`. Updated the S06 test so `s06Group.visible = true` when testing active S06 exclusion inside a `Scene`, and added a dedicated unit test verifying that a hidden group (`visible = false`) inside a `Scene` with other active lights resolves to `{ directional: [], point: [], spot: [] }`.
2. **MAJOR 2 — Pre-existing custom `onBeforeCompile` without custom `customProgramCacheKey` causes WebGLProgram cache collisions**:
   - **Status**: Fixed.
   - **How**: In `computeCombinedCacheKey`, when `state.baseCustomProgramCacheKey === Material.prototype.customProgramCacheKey` and `state.baseOnBeforeCompile !== Material.prototype.onBeforeCompile`, `baseKey` is now computed from `state.baseOnBeforeCompile.toString()` rather than invoking `Material.prototype.customProgramCacheKey.call(material)` (which would read the wrapper `onBeforeCompileLightExclusion.toString()`). Also ensured `clone` and `copy` restore `baseOnBeforeCompile` and `baseCustomProgramCacheKey` before re-applying exclusions. Added a unit test verifying distinct cache keys for two materials with different `onBeforeCompile` hooks and the default `customProgramCacheKey`.
3. **MAJOR 3 — No `layers` filtering and stale program on same-count light swaps**:
   - **Status**: Fixed.
   - **How**: Added optional `layers?: Layers` to `LightExclusionOptions` and filtered candidate lights via `light.layers.test(options.layers)` on the `Light` itself (without pruning child traversal on parent group layer mismatch, matching `WebGLRenderer.projectObject`). Added and exported `refreshLightExclusion(material)` to recompute `state.lastKey` and set `material.needsUpdate = true` when same-count swaps (`.visible`, `castShadow`, `SpotLight.map`, or child-order swaps) occur without bumping `lights.state.version`. Documented both in the header comment of `index.ts` and §2 of this report, and added unit tests for both `layers` filtering and `refreshLightExclusion`.
4. **MINOR 4 — Test gaps for S06/S07, `copy` restoration, and `castShadow` ordering**:
   - **Status**: Fixed.
   - **How**: Expanded the S06/S07 test in `tests/unit/light-exclusion.test.ts` to place `s06Group` and `s07Group` in a shared `Scene`, pass `floorMaterial` through `onBeforeCompile` + `simulateThreeUnroll`, test `platformGlow.castShadow = true` shifting `helixKey` from `point[0]` to `point[1]` (with `refreshLightExclusion` + unrolled shader assertions), and unroll S07 `discShader` (`MeshPhysicalMaterial`) and `treeShader` (`MeshStandardMaterial`) to verify `sun` (`0`) vs `fill` (`1`) are selectively excluded without affecting each other. Added `expect(material.copy).toBe(Material.prototype.copy)` assertions to the zero-cost/restore test.
5. **MINOR 5 — Excluded-light ALU/texture work & `MO-3a-report.md` overstatement**:
   - **Status**: Fixed.
   - **How**: Updated `patchLightExclusionShader` (`patchBucketLoop`) to wrap the post-`get*LightInfo` body through `RE_Direct(...)` in `#if !( UNROLLED_LOOP_INDEX == ... ) ... #endif` (in addition to `#if ( UNROLLED_LOOP_INDEX == ... ) directLight.color *= 0.0; directLight.visible = false; #endif`), so `spotLightMap` texture sampling, shadow lookups, and `RE_Direct` BRDF evaluations are skipped at GLSL preprocessor time for excluded lights. Updated §1 and §3 of this report accordingly.
6. **MINOR 6 — Minor `clone`/`copy` & unused-export hygiene**:
   - **Status**: Fixed.
   - **How**: Unexported internal-only helpers `getLightBucket`, `hasActiveExclusions`, and `LightBucket` from `src/experience/shared/light-exclusion/index.ts`, and documented the `unpatchedMaterial.copy(patchedMaterial)` limitation in both `index.ts` and §2 of this report.
