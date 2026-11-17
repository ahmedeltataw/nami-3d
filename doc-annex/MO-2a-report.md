# MO-2a — asset preparation report

## Round 10 — review fixes and replay

The three contact sheets cited in round 9 were rebuilt using explicit source and destination rectangles in pixel units by `mo2a_evidence_strips.ps1`. Each was opened and inspected, and five source-to-sheet pixel checks passed per tile. The final S07 tile contains the complete hero frame. The lock wrapper now resolves `BLENDER_EXE` or `blender` on PATH. The superseded experimental scripts and the two unused assignments identified in review were removed. `mo2a_s07_sky_fix.py` no longer writes `mo2a_jump6_camera`; only `mo2a_s07_round8.py` owns that key. The S07 manifest records overscan and actual GLB size; the S04 manifest identifies glTF +Y up and marks `phone_exploded_parts` as the authoritative assembly-node list.

The existing S04 box was measured at 1672×941, as reported in round 9. `mo2a_s04_safe_box.py` now uses the manifest's exact 1671×941 hero aspect on future replay. The previously rendered limits and numerical result have **not** been remeasured at that corrected aspect in this review-only pass; their 0.06% aspect difference remains within the documented inward margin, but an exact-aspect replay is needed before claiming new measurements.

To reproduce from the approved pre-MO-2a v2 blends and matching exports, set `BLENDER_EXE` to Blender 5.3 or put `blender` on PATH. Run the following in order from the worktree root. Each Blender command uses `assets-model/scripts/mo2a_run_locked.ps1 -Blend <blend> -Script <script> -Log <path in test-results/MO-2a/>`; the wrapper waits up to 30 minutes and removes its lock on exit. The S03 refinement creates `test-results/MO-2a/s03-before.blend` and `s03-before.glb` from the original inputs if they do not exist; keep those original backups for subsequent replay. Do not substitute backups from a modified asset.

1. On `assets-model/s03_lab_v2.blend`, run `mo2a_s03_refine.py`, then `mo2a_s03_budget2.py`, then `mo2a_s03_station_cameras.py`.
2. On `assets-model/s04_idea_v2.blend`, run `mo2a_s04_parts.py`, then `mo2a_phone_pose.py`, then `mo2a_s04_safe_box.py`. For the phone evidence, run `mo2a_phone_assembly.py` once normally and once with `MO2A_PHONE_MULTIPLIER=2.5`; remove the environment variable afterward. Neither render changes the exported defaults.
3. On `assets-model/s07_future_v2.blend`, run `mo2a_s07_sky_fix.py`, then `mo2a_s07_round8.py`. The latter is the only owner of `mo2a_jump6_camera`.
4. Run `python assets-model/scripts/mo2a_manifest_round10.py`, then run `mo2a_node_check.py` under the lock. If fresh evidence strips are needed, run `assets-model/scripts/mo2a_evidence_strips.ps1` from the worktree root after the corresponding frame renders exist. `mo2a_inspect.py` is an optional export inventory and updates the S03 triangle table; `mo2a_export.py` is a shared helper, not an entry point.

No Blender run was repeated for the review fixes. Review of the corrected camera box at the exact aspect and any runtime/Muse acceptance remain separate from the six requested review fixes.

## Round 9 — final item status

| Item | Accepted / open | Result |
| --- | --- | --- |
| S03 budget | **Accepted by Lead.** | Kit 76,628 triangles; projected 98,870 with the specified robot and props. |
| S07 fly-in | **Accepted by Lead; Muse composition review open.** | Round 8's textured-sky opening and unchanged hero were accepted by Lead. The [six-frame full-resolution strip](MO-2a-evidence/s07-round8-final-strip.png) and 201-pose card-coverage check remain the evidence. |
| S04 backdrop and camera range | **Sampled clamp recorded; Lead decision on Explore open.** | The approved hero card and its existing edges remain unchanged. A conservative symmetric joint box is **yaw −0.79° to +0.79°, pitch −0.79° to +0.79°, dolly −0.079 m to +0.079 m**. **All three axes are smaller than ±1° / ±0.1 m.** `cameraSafeRange` in the S04 manifest has `status: ok`, the criterion, coordinate convention, bounds and validation details. Lead must decide whether Explore uses these narrow limits or hero only. |
| S04 phone | **Both comparison strips recorded; runtime validation open.** | Lead accepted retaining the default offsets. The [1× strip](MO-2a-evidence/s04-assembly-strip.png) and [2.5× comparison](MO-2a-evidence/s04-assembly-2p5-strip.png) are render evidence; no exported default was changed. Actual runtime animation remains untested. |
| Evidence | **Present for Lead's land script.** | The evidence folder remains untracked as instructed; no Git metadata was modified. |

### S04 camera sampling

The criterion compares the approved hero frame to each sampled pose: no new `S04_city` edge ID may enter the viewport; all hero-visible edges must remain visible; and each clipped endpoint may move at most 0.02 frame widths horizontally and 0.02 frame heights vertically. Since projected straight edges interpolate between endpoints, this bounds every point of the corresponding clipped segment for each sampled pose. It identifies edges by mesh edge ID; it does not assert that the exact same *world-space portions* of a partially clipped edge remain visible, and it deliberately ignores occlusion. Yaw rotates around Blender world +Z, pitch around camera-local +X, and dolly along the hero forward direction; joint rotations are yaw × hero × pitch. The script uses the saved hero camera, the approved card and the kit aspect.

`mo2a_s04_safe_box.py` searched a conservative box with yaw and pitch in equal degrees and dolly in one tenth as many metres, rounded inward with an additional 0.02° margin. It then checked an **11×11×11 joint grid**, including all eight corners, and **101 independent samples per axis**. The greatest sampled shifts were **1.134% of frame width** and **1.934% of frame height**. These are finite samples, not a mathematical proof for every continuous pose or a runtime collision/occlusion test. The [limit strip](MO-2a-evidence/s04-safe-limit-strip.png) is ordered hero, yaw min, yaw max, pitch min, pitch max, dolly min, dolly max; [individual limit and corner renders](MO-2a-evidence/s04-safe-box/) are also included. The full-quality render helper now accepts an optional camera quaternion so the rendered poses preserve the measured rotation.

The earlier round 8 “unavailable” status below was based on the stricter, superseded criterion that *no* card edge enter the viewport. The round 9 Lead decision explicitly accepts the existing hero edges. No blend or GLB was changed by this camera-range pass, and no commit or push was made.

## Round 8 — Lead review requested

| Item | Status | Evidence |
| --- | --- | --- |
| S03 | **Accepted by Lead.** | Remains at 76,628 kit triangles; projected 98,870 with the specified robot and props. |
| S07 opening | **Revised and rendered; pending Lead visual acceptance.** | The former candidate started against the glass N. The new cubic path is the final 35% of that curve, keeping the hero position, direction, lens and kit unchanged. The [full-resolution six-frame strip](MO-2a-evidence/s07-round8-final-strip.png) is ordered left-to-right, top-to-bottom; [start](MO-2a-evidence/s07-round8-start.png) shows the textured sky and city rather than gray, and [end](MO-2a-evidence/s07-round8-hero.png) is the unchanged hero camera. The shared kit preset used 1672×941 per frame. Four frustum corners remained inside the sky card at 201 sampled positions. This is a shorter entry, and its suitability for the intended jump needs Lead/runtime review. |
| S04 dusk camera range | **Not available under the specified criterion.** | The approved `S04_city` card was not altered. At `camera_hero`, three of its four boundary edges intersect the camera viewport: for example, the right edge spans normalized viewport coordinates (0.313, 0.267) to (0.320, 0.741). The [approved hero](MO-2a-evidence/s04-approved-hero.png) and [geometric measurements](MO-2a-evidence/s04-camera-hero-edge-check.json) document the baseline. An interval centered on hero cannot satisfy “card edge never enters the frustum” when hero itself fails it. Samples at 0.1° steps over ±5° yaw and pitch, and 0.02 m steps over ±1 m dolly, independently with the other axes held at hero, each found an edge intersection at **101/101** poses. `cameraSafeRange` is therefore recorded as `status: unavailable` with null axis limits; it is not a numeric clamp. No limit renders are claimed because no valid limits were established. Lead must either accept an edge already visible/occluded at hero and define a visual criterion, or approve a backdrop change before a safe clamp can be measured. |
| S04 phone comparison | **Rendered; runtime selection remains open.** | [Default 1× strip](MO-2a-evidence/s04-assembly-strip.png) and [2.5× strip](MO-2a-evidence/s04-assembly-2p5-strip.png) show the same nine b=.25–.60 samples and assembly order. The larger comparison makes screen/body separation more visible. The multiplier was applied only during Blender rendering; exported part directions and distances were not changed. Neither strip tests the runtime sampler or collision/settle behavior. |

`mo2a_s07_round8.py` writes the revised candidate `mo2a_jump6_camera` manifest keys and renders the strip; the earlier failed zero-centered measurement remains in the recorded evidence. Blender ran one process at a time under the shared lock. The evidence directory remains untracked for Lead's land script, as instructed. The following earlier-round material is retained as history and is superseded wherever it conflicts with this table.

**Historical status before Lead's round 9 decisions:** the revised S03 budget passed; S07 and phone required review, and S04 had no range under the earlier, stricter criterion. See the round 9 table above for current status.

## Next round — acceptance by item

| Item | Status | Evidence and limits |
| --- | --- | --- |
| S03 revised budget | **Accepted numerically and at the hero frame.** | `s03_lab_v2.glb` is **76,628** triangles, down 2,778 from 79,406 and 1,130 below the 77,758 cap. With robot low (14,876) and MO-2e props (7,366), the projected total is **98,870**, leaving 1,130. `S03_ceiling_ring` alone was decimated; all six pedestal GLB geometry attribute/index streams match the pre-cut export byte-for-byte. The node check passes 92/92. Compare the [previous hero](MO-2a-evidence/s03-after.png) and [new hero](MO-2a-evidence/s03-budget2-after.png); no material change is apparent at that frame. GLB and all manifest triangle totals agree. |
| S04 dusk | **Not accepted.** | The original 0–25° candidate orbit was rendered at 1° increments (`test-results/MO-2a/s04-dense/`). A second extended-card candidate used mirrored texture repetition to preserve texel density; its [hero](MO-2a-evidence/s04-matte2-failed-hero.png) shows an upside-down city and is unacceptable. The candidate was reverted from the `s04-before-matte2` backup, preserving the phone parts. The original background/room boundary remains visible and no continuous safe range is established. The candidate images are retained in [this strip](MO-2a-evidence/s04-matte2-strip.png). An appropriate outpainted panorama or modeled surrounding architecture is still needed. |
| S07 sky and fly-in | **Coverage passes for the authored path; composition not accepted.** | The card was enlarged 1.6× with UVs extrapolated at the original density, mirrored repeat outside the original image, and a revised cubic path that holds the hero camera orientation. All four frustum corners were tested at 101 evenly spaced path positions; 21 rendered frames are in [the strip](MO-2a-evidence/s07-sky-strip.png). No outer card edge appears in the reviewed samples. At entry the camera is close to and partly inside the glass N, which dominates the first frames; design must approve or revise this path. Hero [before](MO-2a-evidence/s07-flyin-end.png) and [after](MO-2a-evidence/s07-sky-fixed-hero.png) 480 px renders differ by mean 0.00384 RGB levels per channel on a 2-pixel sampling grid, with no sampled pixel differing by more than 15 summed RGB levels. Card UV frustum bounds shift and scale: horizontal span 0.5724→0.6122 and vertical 0.5731→0.6128 in expanded-card UV units; projected centre shift is roughly 5 px horizontally and 5 px vertically at 480×270. The flat skyline itself has no internal depth parallax; nearby 3D objects move against it. A sampled geometric test cannot prove every intermediate frame or hide a parallax break in all motion. |
| S04 phone assembly | **Rendered; visual acceptance and runtime test remain open.** | [Nine-frame strip](MO-2a-evidence/s04-assembly-strip.png) uses the eight manifest directions/distances, with part offsets falling to zero in the plan's order between b=.25 and .60 using cubic ease. The movement is subtle at hero scale and not all internal parts are clearly distinguishable. This is Blender sampling of the intended offsets, not a test of runtime animation, collisions, settle, or per-part visibility. |
| Evidence tracking | **Files present, not Git-tracked.** | Key PNGs are in `doc-annex/MO-2a-evidence/`. Git metadata is read-only in this environment, so the new files cannot be added to the index here; Lead must add them when collecting the work. No commit or push was made. |

The S07 path and sky update are in `mo2a_s07_sky_fix.py`; the revised S03 cut is in `mo2a_s03_budget2.py`, and phone samples in `mo2a_phone_assembly.py`. Every new Blender process observed the shared lock. The final node check reports S01 20/20, S02 23/23, S03 92/92, S04 33/33, S05 54/54, S06 45/45 and S07 16/16 matching. Save logs report a thumbnail-cache write error, while the saved blends/exports reopened successfully. Results below describe the prior round unless superseded here.

The approved saved blends are the source of truth. Card scripts in `assets-model/scripts/mo2a_*.py` operate on the blends, export GLB with Y-up, applied modifiers, extras enabled and cameras/lights/animation disabled, and preserve the existing named node transforms. Blender was run serially under `%TEMP%/nami-blender.lock`. No runtime, app, tests, package or brief files were changed. Gemini review belongs to Lead and was not performed here.

## S03 triangle budget

The original GLB contained **97,550** triangles. The current GLB contains **76,628**, a reduction of **20,922**. All six measured pedestal meshes were rebuilt in the prior round with regular lower-density circular topology, retaining their materials, names, pivots, and transforms. Each pedestal decreased from 8,052 to 5,028 triangles. They were unchanged in the next round. The manifest's `tris_total`, `triangles_total`, and sum of `triangles_by_mesh[*].after` all equal 76,628; its per-mesh table retains the original before counts.

The first collapse-based cut produced harsh highlights and was superseded by the regular-topology version. The full-resolution kit-preset [before](MO-2a-evidence/s03-before.png) and [after](MO-2a-evidence/s03-after.png) images were visually compared; no material loss is apparent at that hero frame. That observation does not establish every close-up or browser view. The original approved blend and GLB were backed up as `test-results/MO-2a/s03-before.blend` and `s03-before.glb`. `mo2a_s03_refine.py` contains the final card operation and an idempotency marker. A Blender thumbnail-cache write error appeared during save, but the blend and GLB were saved and read back successfully.

## S04 phone

The converted `phone_pose_gltf` matches the delivered node. The corner calculation in `test-results/MO-2a/phone-pose-check.json` agrees in Blender and glTF coordinate conventions to the calculation's float precision.

The exported GLB and manifest now contain eight distinct children of `S04_phone`, each with `exploded_direction` and `exploded_distance` extras in glTF-local axes:

| Role | Node | Direction | Distance (m) |
| --- | --- | --- | ---: |
| Back plate | `S04_phone_back_plate` | (0, 0, −1) | 0.55 |
| Buttons | `S04_phone_buttons` | (1, 0, 0) | 0.36 |
| Board | `S04_phone_board` | (0, 0, −1) | 0.28 |
| Battery | `S04_phone_battery` | (0, 0, 1) | 0.28 |
| Speaker | `S04_phone_speaker` | (0, −1, 0) | 0.30 |
| Camera module | `S04_phone_details` | (0, 0, −1) | 0.42 |
| Glass | `S04_phone_body` | (0, 0, 1) | 0.38 |
| Display | `S04_phone_screen` | (0, 0, 1) | 0.60 |

Existing combined detail geometry was split; board and battery were modeled inside the body. The S04 GLB and manifest both report **21,508** triangles. Full-resolution kit-preset [assembled before](MO-2a-evidence/s04-phone-before.png) and [after](MO-2a-evidence/s04-phone-after.png) renders appear consistent at the hero view. `mo2a_s04_parts.py` was run twice; the second run completed with the same node set and triangle count. This does not verify the actual assembly animation, collision, or exploded-part appearance in three.js; those remain for the wiring card.

## Matte cards and camera paths

Renders use the shared `kit_render.py` preset at 480×270 unless noted. They are discrete samples, not a continuous-motion or browser test. The card scripts and their additive manifest keys retain the sampled candidate camera paths.

| Scene | Evidence and observed range | Status |
| --- | --- | --- |
| S01 window | Hero, midpoint and [end of z 13→10.6 push with 3° downward tilt](MO-2a-evidence/s01-push-end.png) were sampled. No obvious exposed card edge in these stills. | The three samples are clear; continuous travel and parallax are not certified. |
| S03 city | Six station keys, 3° drift endpoints and five transition midpoints were rendered in `test-results/MO-2a/s03-stations/`. Example [cloud](MO-2a-evidence/s03-station-cloud.png) and [headphones](MO-2a-evidence/s03-station-headphones.png). | The sampled city background does not show a clear outer card edge in the reviewed views, but foreground plants cross the robot and some views need composition review. The full interpolation and city parallax are not certified. Keys are candidates, not runtime bindings. |
| S04 dusk | The original orbit sample already shows the environment/background boundary at [25°](MO-2a-evidence/s04-orbit-before.png). A 2.5× card extension produced a stretched image and [still exposed a boundary](MO-2a-evidence/s04-orbit-failed-extension.png); the attempted fix was reverted. | **Fail.** No safe continuous orbit range has been established. A backdrop/room redesign or constrained authored camera path needs another visual pass; do not treat the unmodified card as cleared for 0→25°. |
| S07 sky | The former candidate failed at [start](MO-2a-evidence/s07-flyin-start.png) and [near-end](MO-2a-evidence/s07-flyin-near-end.png). The revised card and path are assessed in the next-round table above. | Prior path superseded. |

The failed S04 extension is retained only as evidence, not as an accepted change. The pre-test blend, GLB and manifest were restored before the phone work. `mo2a_s03_station_cameras.py` records its candidate keys without runtime changes; the earlier S07 candidate was superseded by round 8. Render outputs and source backups remain in `test-results/MO-2a/`; key PNGs are copied to the evidence folder.

## Export and node checks

`mo2a_node_check.py` compares every exported node with its source blend after the Blender→glTF basis change. The post-phone check reported S01 **20/20**, S02 **23/23**, S03 **92/92**, S04 **33/33**, S05 **54/54**, S06 **45/45**, S07 **16/16** matching names, parent relationships and local matrices within 0.0001. The scripts also compare the prior node set and local transforms before saving an export. This checks the present exports, not what a future optimizer might merge. `test-results/MO-2a/node-merge-candidates.json` lists all exported mesh nodes conservatively; protect animated parts, anchors, cards, platform and arms from merging and repeat the check after optimization.

The GLB triangle counts were read directly from their triangle primitives. Node checks, metadata inspection and the full-size hero renders are the validations performed; no build, e2e, GPU suite, runtime wiring, portrait framing, KTX2/WebP work or browser parity check was run. The Blender process logged a thumbnail-cache write error on saves; the actual files were written and subsequently opened for node checks.

## Remaining acceptance work

1. Lead decides whether S04 Explore uses the recorded narrow safe box or the hero camera only; MO-10d implements and validates that decision.
2. Review the revised S07 entry composition and assess the sampled flat-sky parallax in motion at vFOV 22.9°; verify the runtime uses the authored path.
3. Review and refine S03 station compositions and camera interpolation; test S01 and S03 motion continuously and establish actual safe ranges.
4. In MO-2b, wire and test the phone parts and camera paths, verify the optimized exports retain their nodes, and complete the deferred browser and texture work. Add the evidence folder to Git.

> Evidence images moved to the inbox repo to keep the main repo small: `ahmedeltataw/nami-muse-inbox` → `captures/MO-2a/` (same file names; paths below that start with `MO-2a-evidence/` live there).
