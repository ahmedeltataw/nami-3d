# MO-2 Report — v2 Scene Kits Wired (Round 2)

- **Worktree**: `D:\website\Nami-3D\.worktrees\MO-2` (branch `task/MO-2`, uncommitted)
- **Scope**: Wired `s01`–`s07` to `assets-model/export/s0{1..7}_*_v2.glb` + `.manifest.json`, compressed embedded PNG textures to `EXT_texture_webp` via `scripts/pack-v2-models.mjs` (`ffmpeg` `libwebp`), enforced hero parity and Blender Z-up -> glTF Y-up joint pose application at `b = 0`, applied runtime shader/material rules (`v2Materials.ts` + `matte.ts`), preserved downstream interactive features (S02 charge orb, S03 bindings, S04 Explore layers + `drawDisplay`, S05 `Gallery` mini-worlds + `nami:gallery-orbit`, S07 core/shapes), and verified all unit + E2E gates.

---

## 1. Per-Scene Hero Parity & Assets (`b = 0`)

| Scene | Served Kit (`public/models/...`) | Reused Legacy Assets | Camera Pos (`gltf`) | Camera `look_dir` / `fov` / `clip` | Robot Root (`gltf`) / `yaw` / `tilt` / LOD | Special Parity, Materials & Wiring |
| --- | --- | --- | --- | --- | --- | --- |
| **S01** | `s01/s01_hero_v2.glb` (`858,060` B) | `poster:s01` | `[0, 1.7, 13]` | `[0, 0.139, -0.99]`, `39.8°`, `[0.1, 3000]` | `[-2.15, 1.25, 5]`, yaw `22°`, tilt `15°`, `high` | 11 `hero_s01` poses converted via `blenderRawXyzwToGltfXyzw` + `applyFingerRestYaw` (`±22°`) and applied via `visual.robotPose` -> `layers.jointPoses`; `M_S01_Leaf` promotes `COLOR_1` + `vertexColors: true`; `S01_window_city` unlit `fog: false`; legacy room sway removed; `portraitFraming` data-only. |
| **S02** | `s02/s02_portal_v2.glb` (`1,044,240` B) | `poster:s02` | `[0, 2.4, 0]` | `[0, 0, -1]`, `73.74°`, `[0.1, 100]` | `[-1.72, 0.19, -5.1]`, yaw `-25°`, `high` | Preserves hand-anchored `S02_EnergyOrb`, `ParticleField`, portal ring/tunnel/swirl/glow updates, `previewVisible`, and `s02PortalData.centre_gltf` (`[4.5, 3.6, -10.5]`). |
| **S03** | `s03/s03_lab_v2.glb` (`2,202,256` B) | `poster:s03`, `station_1..6.glb` via `s03_demo_bindings.json` | `[0.15, 4, 10.6]` | `[0, -0.0941, -0.9956]`, `50.46°`, `[0.1, 100]` | `[0, 1, 0]`, yaw `0°`, `low` | `Robot.tsx:33-36` selects `robot_low.glb` per `SCENE_HEROES.s03.robot.lod`; 26 bindings placed at `worldOriginGlb`; `S03_backdrop_city` unlit `fog: false`; `S03_arm_L`/`R` intact. |
| **S04** | `s04/s04_idea_v2.glb` (`1,193,356` B) | `poster:s04` | `[0, 1.4, 10.1]` | `[-0.104, 0.105, -0.989]`, `45.77°`, `[0.1, 100]` | `[-3.6, -0.1, 3.4]`, yaw `0°`, `high` | `S04_phone` split into `Frame` + `BackPlate..Display` proxies around `S04_phone_*` (`s04PhoneData.explodedParts`) for pointing & Explore layer toggles; `drawDisplay` on `S04_phone_screen`; `M_Beam` `AdditiveBlending`/`depthWrite: false`; `S04_city` unlit `fog: false`. |
| **S05** | `s05/s05_multiverse_v2.glb` (`2,336,212` B) | `poster:s05`, `world_*.glb`, `screens/*.webp` | `[-0.81, 1.62, 22.275]` | `[0, 0.122, -0.993]`, `31.47°`, `[0.1, 100]` | `[-3.3, 0, 9.5]`, yaw `62°`, `high` | `Shoulder_L` (`blenderQuatWxyzToGltfXyzw`) applied at `b = 0`; `new Gallery(...)` wired via `S05_GalleryShellProxy`/`Gate_1..6` aligned to `S05_bubble_*` + `nami:gallery-orbit`; `M_Bubble_Glass`/`M_Globe_Glass`/`M_Beam` translucent; `gallery.ts` untouched. |
| **S06** | `s06/s06_dna_v2.glb` (`1,129,508` B) | `poster:s06`, `s06/logo_3d.glb` (`428,652` B) | `[-0.12, 0.48, 12.9]` | `[0, 0.156, -0.988]`, `33.4°`, `[0.1, 100]` | `[-2.8, 0, 1.4]`, yaw `40°`, `high` | `S06_stage` scale `0.6`; `Shoulder_L`/`Shoulder_R` (`blenderQuatWxyzToGltfXyzw`) applied at `b = 0` so left arm aims toward helix and right hand holds `S06_tablet`; `M_Helix_Glass` & `M_Beam` translucent; `S06_ValueTarget` reads `s06DnaData.helix.value_pill_anchors_gltf`. |
| **S07** | `s07/s07_future_v2.glb` (`1,133,804` B) | `poster:s07` | `[-5.5, 0.1, 17]` | `[0.498, 0.093, -0.862]`, `22.92°`, `[0.1, 3000]` | `[0, -0.06, 0]`, yaw `150°`, `high` | Far plane `3000`; `S07_sky_city` unlit `fog: false`, `depthWrite: false`, `MIRRORED_REPEAT` (`wrapS = wrapT = 33648`) + `1.6x` overscan; `S07_CoreAnchor` (`S07_EnergyCore`) & `S07_Shapes` anchored at `s07FutureData.logo.centre_gltf` (`scale = 6`). |

Shared robot scale in `src/experience/robot/placement.ts` and `src/experience/robot/Robot.tsx` uses `scale: 1` with `pivot: 'bottom'` (`y = 0` GLB origin), and `Robot.tsx:33-36` selects `robot_low.glb` when `SCENE_HEROES[activeScene]?.robot.lod === 'low'` (`s03`) and `profile.quality` otherwise.

---

## 2. §8 Triangle Budgets & WebP Packing

Verified in `tests/unit/mo2-kits.test.ts:445-490` (including runtime-selected robot LOD and procedural meshes, all `<= 100,000` triangles per frame):

| Scene | Kit Tris | Robot Tris (`SCENE_HEROES[id].robot.lod`) | Extra Reused / Procedural Tris | Total Active Tris | Budget (`<= 100k`) | Source GLB -> Packed `EXT_texture_webp` GLB |
| --- | --- | --- | --- | --- | --- | --- |
| **S01** | `23,990` | `39,682` (`high`) | `0` | **`63,672`** | Pass | `5,093,480` B -> `858,060` B |
| **S02** | `42,840` | `39,682` (`high`) | `0` | **`82,522`** | Pass | `2,785,000` B -> `1,044,240` B |
| **S03** | `76,628` | `14,980` (`low`) | `7,366` (`station_1..6.glb` demo props) | **`98,974`** | Pass | `6,121,188` B -> `2,202,256` B |
| **S04** | `21,508` | `39,682` (`high`) | `0` | **`61,190`** | Pass | `6,278,160` B -> `1,193,356` B |
| **S05** | `53,606` | `39,682` (`high`) | `0` | **`93,288`** | Pass | `17,035,236` B -> `2,336,212` B |
| **S06** | `26,860` | `39,682` (`high`) | `7,326` (`logo_3d.glb`) | **`73,868`** | Pass | `6,921,196` B -> `1,129,508` B |
| **S07** | `33,494` | `39,682` (`high`) | `2,334` (`S07_EnergyCore` + `S07_Shapes`) | **`75,510`** | Pass | `4,961,660` B -> `1,133,804` B |

- `§7 #7` named joint hierarchy (`Root`, `Torso`, `Neck`, `Head`, `Eye_L`, `Eye_R`, `Shoulder_L`/`R`, `Upper_L`/`R`, `Wrist_L`/`R`, `Palm_L`/`R`, `LeftHand_Anchor`/`RightHand_Anchor`) verified intact in both `robot_high.glb` and `robot_low.glb`.

---

## 3. Data-Only Typed Manifest Accessors (`src/experience/scenes/manifests.ts`)

All manifest geometry, framing, material, and byte-budget constants live in `.manifest.json` / `robot_clip_data.json` and are read dynamically:
- `SCENE_HEROES` / `getSceneHero(id)` / `kitAssetSpec(id)`: hero camera, robot transform, Blender-to-glTF converted `jointPosesXyzw`, `stageScale`, `matteCard`, `packedBytes`, and `portraitFraming` constraints (data-only).
- `s02PortalData`: `s02_portal_v2.manifest.json` `portal` metadata (`centre_gltf`, `nodes`, `tunnel`, `lab_view`).
- `s03BindingsData`: 26 bindings, pedestals, roles, cards, and `mo2a_station_camera_keys`.
- `s04PhoneData`: 8 `explodedParts`, `explodedDirectionSpace`, `poseBlender`, `poseGltf`, and `cameraSafeRange`.
- `s05MultiverseData`: `globe` & `bubbles`.
- `s06DnaData`: `stage`, `helix`, and `heldProp`.
- `s07FutureData`: `flyInPath`, `backdropOverscan`, `logo`, `orbit`, and `trail`.

---

## 4. Round 2 Review Findings Fixed

| # | Severity | Finding | Resolution (`file:line`) |
| --- | --- | --- | --- |
| 1 | Blocker | Blender Z-up -> glTF Y-up joint quaternion conversion + S01 finger `±22°` rest yaw | Implemented `blenderQuatWxyzToGltfXyzw` (`[q[1], q[3], -q[2], q[0]]`), `blenderRawXyzwToGltfXyzw`, and `applyFingerRestYaw` in `src/experience/scenes/manifests.ts:67-91`, reading `robot_clip_data.json` + manifest poses (`manifests.ts:189-194,287,307-308`). |
| 2 | Blocker | Hero joint poses stored on `visual.robotPose` never applied at runtime | Consumed `visual.robotPose` -> `layers.jointPoses` in `src/experience/robot/Robot.tsx:115-116` and applied in `src/experience/robot/compose.ts:133-138`; emitted at `b = 0` in `s01/scene.ts:46`, `s05/scene.ts:71`, `s06/scene.ts:42`. |
| 3 | Blocker | S05 `Gallery` & `nami:gallery-orbit` disconnected, blank `s05-world.png` | Restored `new Gallery(gl, shellProxy, portalProxy, ...)` with `Gate_1..6` aligned to `S05_bubble_${key}`, `world.*` loading, `getProjects`, and `nami:gallery-orbit` in `src/experience/scenes/s05/index.tsx:29-131` without touching `gallery.ts`. |
| 4 | Blocker | Material/shader regressions baked into `s04`, `s05`, `s06`, `s01` baselines | Added `src/experience/assets/v2Materials.ts:41-144` (`M_Beam` `AdditiveBlending`/`transparent: true`/`depthWrite: false`; `M_Bubble_Glass`/`M_Globe_Glass`/`M_Helix_Glass` translucent; `M_S01_Leaf`/`M_Rock`/`M_Grass`/`M_Leaf` `vertexColors: true` promoting `_color_1` -> `color`) and regenerated clean baselines. |
| 5 | Major | S04 broken `assemblyOrder` / Explore toggles & stubbed `drawDisplay` | Wrapped `S04_phone` frame in `Frame` (`s04/index.tsx:67-89`) and `S04_phone_*` into `BackPlate..Display` proxies (`s04/index.tsx:91-111`), and restored `drawDisplay` on `S04_phone_screen` (`s04/index.tsx:113-171`). |
| 6 | Major | S07 `S07_EnergyCore` & `S07_Shapes` buried inside pedestal at origin | Anchored `S07_CoreAnchor` (`S07_EnergyCore`) and `S07_Shapes` at `s07FutureData.logo.centre_gltf` with `S07_CORE_SCALE = 6` (`src/experience/scenes/s07/index.tsx:17-18,118-144`). |
| 7 | Major | S01 legacy `ctx.root` sway & runtime portrait offset | Removed `ctx.root.rotation.y` sway and kept `portraitFraming` data-only (`src/experience/scenes/s01/scene.ts:10-61`). |
| 8 | Major | Incomplete/self-referential unit parity & budget tests, runtime S03 LOD | Independent `independentBlenderToGltfQuat` + `RobotComposer` bone/finger checks in `tests/unit/mo2-kits.test.ts:120-335`, runtime S03 `'low'` LOD in `Robot.tsx:33-36`, `s07ProceduralTris` (`2,334`) in `mo2-kits.test.ts:466-488`, manifest imports in `s01.test.ts`–`s07.test.ts`. |
| 9 | Major | `tests/e2e/motion-foundations.spec.ts` 10 scattered timeout edits vs MO-1c | Reverted all timeout edits in `motion-foundations.spec.ts` leaving ONLY line `53` (`cameraZ` `9 -> 10.6`); moved SwiftShader timeout config centrally to `playwright.config.ts:5-10`. |
| 10 | Major | S02 deleted hand-anchored charge orb/rings & dead exports | Restored `S02_EnergyOrb` between `LeftHand_Anchor`/`RightHand_Anchor`, `ParticleField`, ring/portal/glow/labView updates, and `previewVisible` (`src/experience/scenes/s02/index.tsx:30-200`); kept `s02/scene.ts` and `s03/scene.ts:84-99` clean. |
| 11 | Minor | `tests/e2e/s01.spec.ts:51` energy-line timeout bump | Kept strict `5000` ms on GPU (`PLAYWRIGHT_GPU === '1'`) and `15_000` ms + comment on SwiftShader (`tests/e2e/s01.spec.ts:51-52`). |
| 12 | Minor | Duplicated kit loader boilerplate & byte counts | Extracted shared `useSceneKit` hook (`src/experience/scenes/useSceneKit.ts:34-110`) across `s01`–`s07/index.tsx` and `kitAssetSpec` (`manifests.ts:339-346`) in `s01`–`s07/assets.ts`. |
| 13 | Minor | Hardcoded magic numbers in `manifests.ts`, `s02/scene.ts`, `s06/index.tsx` | Moved `hero_s01`, `portrait_framing`, and `matte_card` into `.manifest.json` / `robot_clip_data.json` (`manifests.ts:189-332`); wired `s02PortalData.centre_gltf` (`s02/scene.ts:54`) and `s06DnaData.helix.value_pill_anchors_gltf[0]` (`s06/index.tsx:57-58`). |

---

## 5. Verification Gates & Baselines

- `pnpm check` (`eslint .`, `tsc --noEmit`, `vitest run`): **40 test files passed (40), 358 tests passed (358)** (`0` errors, `0` warnings).
- `pnpm build`: **122/122 static pages built cleanly**.
- `CI=1 pnpm test:e2e --workers=1` (`--grep-invert @gpu`, run across 4 non-overlapping `--workers=1` batches across all 22 spec files): **91 passed, 0 failed**:
  - `experience.spec.ts`, `motion-foundations.spec.ts`: **20 passed (9.4m)**
  - `robot.spec.ts`, `s01.spec.ts`, `s02.spec.ts`, `s03.spec.ts`, `s04.spec.ts`, `s05.spec.ts`, `s06-s07.spec.ts`: **15 passed (5.2m)**
  - `particles.spec.ts`, `transitions.spec.ts`, `time-machine.spec.ts`, `webgl.spec.ts`, `sound-and-motion.spec.ts`, `m5-director-factory.spec.ts`, `m5-navigation.spec.ts`: **16 passed (2.1m)**
  - `accessibility.spec.ts`, `content-pages.spec.ts`, `forms.spec.ts`, `navigation.spec.ts`, `smoke.spec.ts`, `styleguide.spec.ts` (plus `time-machine.spec.ts`): **42 passed (2.5m)** (`40` unique + `2` `time-machine`)
- Boundary checks: `src/experience/scenes/s05/gallery.ts` and `src/experience/controller.ts` untouched; `tests/e2e/motion-foundations.spec.ts` modified only at line `53` (`9 -> 10.6`).

### Updated Baselines (`tests/e2e/__screens__/`) & Round 2 Pairs (`test-results/MO-2/baselines-r2/`)

All 9 updated baselines were visually inspected (`view_file`) and saved with `*-before-main.png`, `*-after-r2.png`, and side-by-side `<name>.png` pairs in `test-results/MO-2/baselines-r2/`:
- `test-results/MO-2/baselines-r2/robot-s01.png`
- `test-results/MO-2/baselines-r2/s02-charge.png`
- `test-results/MO-2/baselines-r2/s02-portal.png`
- `test-results/MO-2/baselines-r2/s04-exploded.png`
- `test-results/MO-2/baselines-r2/s04-final.png`
- `test-results/MO-2/baselines-r2/s05-gallery.png`
- `test-results/MO-2/baselines-r2/s05-world.png`
- `test-results/MO-2/baselines-r2/s06-dna.png`
- `test-results/MO-2/baselines-r2/s07-core.png`

(`s01-start.png`, `s01-dolly.png`, and `s03.png` belong to `@gpu` tests skipped by `--grep-invert @gpu` and remain unchanged.)
