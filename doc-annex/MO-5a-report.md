# MO-5a report

**Status: Forearm accepted; fingers ready for review. IK is deferred to MO-5 runtime.**

## Finger and forearm changes

The isolated part identified in the prior evidence is `Hand_R_Thumb`; its mirror is `Hand_L_Thumb`. The original source has three separately modelled capsule phalanges per finger and two per thumb. The revision slightly expands each phalanx to close its seams and adds small finger-owned knuckles at all ten pivots. Palm-owned tapered connector geometry runs from the palm toward the pivots. Separate connector geometry is generated per LOD because the accepted low LOD's right index default pivot differs from the high LOD. The existing joint and anchor transforms remain unchanged.

The formerly separate right index in the low Wave pose now has a visible connector. That connector is longer than the others due to the existing pivot; the Lead found it acceptable for the low LOD in the views reviewed. The accepted forearm modification shortens the lower shell from z=0.35 m to the wrist pivot z=0.50 m without moving pivots.

## Verification

- Blender 5.3 exported both LODs through `robot-model/scripts/export_mo5a.py`; the script exports geometry and carries forward the unchanged animation arrays and original node transforms. The public GLBs are byte-identical to the corresponding `robot-model/export/` files after copying.
- Node names, parent relationships, local transforms and mesh status matched the accepted public baseline exactly for each LOD. All 16 animation names and all 168 animation channels per LOD matched in targets, interpolation, time arrays and value arrays; maximum array difference was 0. The head, arm, hand and finger nodes remain separate. Both manifest schemas, anchors and `choreography.glb` are unchanged; only the four LOD count values in each manifest were updated.
- High: **39,682 triangles** versus 39,386 (+0.75%); low: **14,980** versus 14,876 (+0.70%). Both are within ±1%. Both `public/models/robot/manifest.json` and `robot-model/export/manifest.json` now record these values for `triangles` and `blender_triangles`. A search of `src/` and `tests/` for 39386, 14876, 39,386 and 14,876 found no hard-coded old counts.
- A Blender BVH test imported the exported candidate GLBs, welded duplicated shading-seam vertices for component analysis, and built triangle-surface BVHs for the palm and each disconnected finger component. Surface-intersection edges were traversed from the main palm component; intersections have zero triangle-surface distance. Every component was reachable for both hands, both LODs, at rest, S01, Point 0.7 s, Present 0.8 s and Wave 0.8 s: **20/20 hand-pose checks had zero unreachable components**, 25 connected components per check. The test validates the sampled poses, not all intermediate animation times or collision quality. Its script and output are `test-results/MO-5a/contact_v2.py` and `contact_v4.log` (test-results is ignored by Git).
- `pnpm check` passed: lint, typecheck and all 36 test files (299 tests). The focused `pnpm exec vitest run tests/unit/robot.test.ts` also passed (16 tests), loading both new GLBs. Vite native-config and Three.js CommonJS deprecation warnings were emitted. The worktree had no `node_modules`; an existing MO-1 installation was reused temporarily and the junction was removed after testing.
- The EEVEE exports logged a thumbnail-cache write error for Blender's local preview; both GLBs and the source blend were saved. No build, e2e or GPU suite was run, per the resource rule. No runtime code or tests were modified.

## Evidence

`doc-annex/MO-5a-evidence/{high,low}_{rest,hero_s01,Point,Present,Wave}_{L,R}_{palm,back}.png` contains **40** lit, dark-background views from the exported GLBs. All non-hand geometry except the wrist is hidden to expose the hand. Point, Present and Wave use channel values sampled from their GLBs at 0.7, 0.8 and 0.8 seconds; the S01 pose uses the provided hero joint quaternions, not the S01 scene's mesh offsets or wrist translations. These are isolated inspection renders, not full-scene S01 parity. `test-results/MO-5a/render_v2.py` records the rendering process.

## Clip data and IK

`assets-model/export/robot_clip_data.json` contains durations, loop flags, end-at-rest flags and representative apex times. S01 quaternion values come from its referenced script, S05 and S06 from their manifests; S02–S04 do not specify joint quaternions and S07 states rest. S01 also used wrist translations and palm scale in its scene reference, so quaternions alone do not recreate that full reference.

Manifest rest-pivot distances in metres: shoulder→elbow 0.392532, elbow→wrist 0.660705 on both sides; wrist→anchor 0.156525 left and 0.156512 right. Both elbows have X and Y limits rather than a clean single hinge. A constrained two-bone solve and actual tablet, pen and globe targets are deferred to MO-5 runtime; no IK validity claim is made here.

## Files changed and follow-up

- `robot-model/robot_rig2.blend`, `robot-model/scripts/rig_fix_mo5a.py`, `rig_export.py`, `clips_bcd.py`, `export_mo5a.py`, and `robot-model/export/robot_{high,low}.glb`.
- `public/models/robot/robot_{high,low}.glb`, `public/models/robot/manifest.json`, `robot-model/export/manifest.json`, `assets-model/export/robot_clip_data.json`, this report and the 40 evidence PNGs.
- Lead: complete review, run Gemini review and rebaseline `tests/e2e/__screens__/robot-s01.png` after MO-1. MO-5: validate constrained IK. No commit or push was made.

## MO-1 merge and final gates

`HEAD` is at `f6aafa1b` (`main`, post-MO-1 merge). In this continuation session, `pnpm test:e2e` (`node scripts/run-e2e.mjs --grep-invert @gpu`, `CI=1`, 1 worker) was executed after the merge:

- **Initial `next build` attempt**: failed with a transient Windows `EPERM: operation not permitted, mkdir 'D:\website\Nami-3D\.worktrees\MO-5a\.next\server\app\en\projects'`. Retried once; `next build` succeeded (`122/122` static pages).
- **Full e2e totals (`CI=1 pnpm test:e2e`, excluding `@gpu`)**: **91 tests run — 87 passed, 4 failed** (14.3 m).
- **Affected / failed spec re-runs (`CI=1`)**:
  - `tests/e2e/s04.spec.ts` + `tests/e2e/s05.spec.ts`: **4 passed, 0 failed** (1.1 m).
  - `tests/e2e/motion-foundations.spec.ts -g "1280px"`: **0 passed, 2 failed** (both timed out / failed to reach readiness under SwiftShader).

## E2E screenshot baseline triage

None of the e2e specs use `toHaveScreenshot` or `toMatchSnapshot`; they call `page.screenshot({ path: 'tests/e2e/__screens__/...' })`, which overwrites the PNG on disk whenever the test reaches that line. `tests/e2e/__screens__/*.png` on `HEAD` were last committed at `9d5f42ab`, prior to `MO-1` (`f6aafa1b`) and `MO-2a` (`76950e1f`) merging into `main`. Comparing each modified screenshot against `git show HEAD:<file>`:

| File | Decision | What changed vs `HEAD` |
| --- | --- | --- |
| `tests/e2e/__screens__/s04-exploded.png` | **Kept** | Differences are confined to the robot bounding box (`[206, 150 .. 552, 564]`; **0 pixels** with channel delta > 4 outside `[200..560, 140..575]`). Inside the robot: MO-5a hand/forearm geometry plus minor 1–2 px idle hover-bobbing phase offset (ambient motion is not frozen in `s04.spec.ts`). Re-verified by `s04.spec.ts` passing (`1/1`). |
| `tests/e2e/__screens__/s01-dolly.png` | **Restored** | Pre-existing modification from an earlier run (`s01.spec.ts:19` is tagged `@gpu` and skipped by `--grep-invert @gpu`). S02 Arabic heading/body text is scrolled into the bottom half in `HEAD` and absent in the new capture (`MO-1` `scroll-map.ts`), plus MO-5a hands/forearms. |
| `tests/e2e/__screens__/s01-start.png` | **Restored** | Pre-existing modification (`@gpu`). `"تخطّي المقدمة"` skip-button focus ring changed (`MO-1` `SkipIntro.tsx`), plus MO-5a hands/forearms and idle bobbing phase. |
| `tests/e2e/__screens__/s02-charge.png` | **Restored** | Green focus ring around S02 `<h2>` from `MO-1` programmatic heading focus (`src/experience/controller.ts:184`), plus MO-5a hands/forearms. |
| `tests/e2e/__screens__/s02-portal.png` | **Restored** | Green focus ring around S02 `<h2>` (`controller.ts:184`), bottom-right gallery pill buttons scrolled out of frame (`MO-1` `scroll-map.ts`), portal rotation phase, plus MO-5a left forearm/hand. |
| `tests/e2e/__screens__/s04-final.png` | **Restored** | S05 HUD (`"التصنيف غير متاح / ريف الجوف"`) no longer bleeds into S04 `local=0.95` and project pills/phone parts reflect `MO-1` + `MO-2a` (`s04/index.tsx`), plus MO-5a hands/forearms. |
| `tests/e2e/__screens__/s05-gallery.png` | **Restored** | Green focus ring around `"ريف الجوف"` (`controller.ts:184`), plus minor robot edge diff on the far left. |
| `tests/e2e/__screens__/s05-world.png` | **Restored** | Both 3D trees inside the portal world rotated (idle sway/drag timing), plus minor robot edge/wrist diff. |
| `tests/e2e/__screens__/s06-dna.png` | **Restored** | `MO-1` S06 layout/padding (`src/experience/scenes/s06/panel.module.css` `+5rem` top padding, card 7 & bottom panel placement) and green focus ring on `"قيمنا الجوهرية"` (`controller.ts:184`), plus MO-5a hands/forearms. |
| `tests/e2e/__screens__/s07-core.png` | **Restored** | `MO-1` S07 layout (`src/experience/scenes/s07/panel.module.css` `@media (max-height: 760px)` switching the 4 cards from 1x4 to 2x2 at 1280x720), plus MO-5a hands/forearms. |
| `tests/e2e/__screens__/robot-s01.png` | **Restored** | Also modified by `tests/e2e/robot.spec.ts` (not in the 10-file list). Robot pose changed from `Wave` (right arm raised in `HEAD`) to arms-down (`MO-1` `src/experience/robot/intro.ts` switching from wall-clock elapsed to `introTime`), plus MO-5a hands/forearms. |

*Restoration note*: `git checkout -- <file>` is blocked in this worktree sandbox (`fatal: Unable to create 'D:/website/Nami-3D/.git/worktrees/MO-5a/index.lock': Permission denied`), so the exact `HEAD` blob bytes for all 10 restored files were written back via `git show HEAD:<file>`, leaving `git status` clean for all 10 and leaving only `tests/e2e/__screens__/s04-exploded.png` modified among screenshots.

## Remaining e2e failures and causes

1. `tests/e2e/content-pages.spec.ts:34:5` (`ar: content routes have visible h1 and no console errors`) — failed on `/ar/projects` with 18 `Failed to load resource: net::ERR_NAME_NOT_RESOLVED` console errors. **Cause**: `src/content/ar/projects.json` references external images on `https://backend.nami-tec.com/storage/...`, which cannot resolve DNS inside the offline sandbox. Unrelated to MO-5a.
2. `tests/e2e/content-pages.spec.ts:34:5` (`en: content routes have visible h1 and no console errors`) — failed on `/en/projects` with 15 `Failed to load resource: net::ERR_NAME_NOT_RESOLVED` console errors. **Cause**: same offline DNS block on external `backend.nami-tec.com` project images. Unrelated to MO-5a.
3. `tests/e2e/motion-foundations.spec.ts:83:3` (`S06 hero clears navigation and S07 actions remain clickable throughout the body at 1280px`) — exceeded the 60,000 ms test timeout (on `page.screenshot` in the full run; on `locator.click` in the isolated re-run). **Cause**: SwiftShader software WebGL rendering across S06/S07 scrolls, 16 button clicks, and two full-page screenshots exceeds the 60 s default timeout on this host. (The 390 px counterpart passed in the full run; the isolated `-g "1280px"` run also hit a 15 s `data-ready` timeout on `motion-foundations.spec.ts:177` at `#s05`.) Unrelated to MO-5a.
4. `tests/e2e/s05.spec.ts:3:1` (`cold Arabic gallery renders and all project links resolve`) — failed in the full run waiting 30,000 ms for `[data-experience][data-ready="true"]` on `/ar#s05` (`data-scene="s05"`, `data-renderer="webgl"`, `data-ready="false"`). **Cause**: transient SwiftShader cold-load timeout under sustained CPU load during the 91-test run; when re-run in `tests/e2e/s05.spec.ts` (`CI=1`), all 3 tests in `s05.spec.ts` **passed** (`4/4` combined with `s04.spec.ts` in 1.1 m).

No commit or push was made.
