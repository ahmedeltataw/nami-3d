# MO-1 runtime foundations

Branch `task/MO-1`; baseline `1596ed6c6beeaf85ae4dcc282b3c9960da9ddba2`. No commit or push. `doc/`, `briefs/`, model assets and dependencies are unchanged. The requested [site motion inventory](MO-1-site-motion.md) was written before runtime edits; its file:line references describe that baseline.

## Contract and ownership

`TransitionIntents` now carries `owner`, fractional `fromVisibility`/`toVisibility`, `portal`, `wash`, `dissolve`, `robotPose`, `background`, `fog`, `exposure`, `lights` and `ui`. `clipA`/`clipB` contain explicit sampled robot directives, including clip times; `weight` crossfades B and `poseWeight` blends the pose layer. Host feeds the composer, DOM timelines, scene opacity/light composition, fog/exposure, and typed portal/particle channels. Portal meshes, live preview, dissolve shader and new lighting remain neutral for their later cards; no new scene geometry is introduced.

Six default beats and typed boundary overrides live in `transitions/beats.ts`. The S02→S03 override includes opaque `.55–.60` and dissolve `.34–.40`; S03→S04 and S06→S07 use their approved opaque intervals. A pure t sampler switches camera owner, visibility, background, fog, rig weights and lens together at the opaque midpoint. Host applies the camera once before robot sampling; scroll poses snap, Explore alone uses damping. Visibility and light factors are composed after scene writers, then restored before the next sample.

## Scroll map

All values below are vh from narrative start. Each jump is 55 vh source head + 55 vh destination tail = 110 vh. Total remains **2280 vh**. The footer is excluded from the S07 span.

| Scene | Start | Tail | Body | Head | Hero (b=0) | Departure (b=1) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| S01 | 0 | 0 | 125 | 55 | 0 | 125 |
| S02 | 180 | 55 | 130 | 55 | 235 | 365 |
| S03 | 420 | 55 | 430 | 55 | 475 | 905 |
| S04 | 960 | 55 | 210 | 55 | 1015 | 1225 |
| S05 | 1280 | 55 | 370 | 55 | 1335 | 1705 |
| S06 | 1760 | 55 | 310 | 55 | 1815 | 2125 |
| S07 | 2180 | 55 | 45 | 0 | 2235 | 2280 |

`SampleInput.local`, runtime `local` and `b` describe the body; `narrativeLocal` preserves the physical tail/body/head coordinate. `mapScroll` exposes physical `local`, `b`, phase and jump `t`. `controller.seek(scene,b)`, hero navigation, hashes, station/project seeks and Director durations use this table. Existing station/project window shares and held-frame seek formulas are retained inside their bodies. Director timing uses 40 vh/s over table-derived hero distances; skip/navigation target heroes directly and focus headings. Ordinary scroll never calls focus. Capture query parameters survive scene navigation.

## What moved

- S02 no longer imports/samples S03 for its reveal camera or destination robot placement. Its approach/portal body remains; the transition now owns the cross-scene camera move.
- S03's `.97–1` camera blend to S04 moved to the jump layer; station cameras and body behavior remain local.
- S05's exit camera blend to S06 moved to the jump layer; project windows and mini-world rendering remain local.

## Clocks, readiness and overlays

Ambient and intro clocks clamp steps to 100 ms and freeze under reduced motion. All named §2.1 ambient consumers use that clock and a charge/landing amplitude envelope. Intro samples explicit intro time; its existing clip timing is retained for MO-10a. Replay uses a GSAP body proxy with a continuous return; S07 picks use a killed/replaced GSAP proxy and become instant under reduced motion. The duplicate S07 core-scale writer was removed as part of that integration.

Capture: `?capture=1&ambient=6&intro=2`; programmatic override: `window.__namiCapture({ambientTime:6,introTime:2})`, or `null` to resume. `scrollToProgress(p,true)` provides a cold seek for e2e. Capture disables live gaze/reactions. Narrative sampling is independent of readiness; a hold covers the retained t at beat four, clears after assets/context/shader warm-up, and cold presentation samples the owning scene's b=0 hero behind its poster fade. Forward preload starts at b≥.5; reverse residency uses viewport distance.

One DOM root owns the S01 headline and S02 copy demonstration. Paused, context-scoped GSAP timelines scrub with suppressed callbacks; projection, scene and jump wrappers are separate. Source/destination overlays are inert during jumps. Reduced/fallback paths retain server HTML in normal flow. Active Director controls are portaled outside scene fading so pause/skip/exit remain available.

## Visible changes

1. Body pacing reserves the jump spans in the table; hero navigation lands after each arrival tail.
2. Cross-scene camera travel now occurs in jumps, with the lens/background/scene swap hidden by the emerald-to-white DOM wash. Existing S02 body flash remains for removal in MO-6b.
3. Unready jumps show the wash and a small emerald loading pulse; cold seeks show the owner's hero poster.
4. S01/S02 copy follows the prescribed jump fade/inert schedule; navigation, skip and section keys focus the destination heading.
5. Ambient motion settles during jumps; reduced motion shows stationary hero cameras. Idle no longer receives a second procedural float layer. S04 Replay returns smoothly, and reduced S07 selection is instant; S07 core scale has one writer.

## Validation and remaining review

- Final Carbon review round 2 verification (`CI=true`): **`pnpm check` passed** (lint, TypeScript, 37 unit files / 323 tests); **`pnpm build` passed** (122 static pages); **`pnpm test:e2e` passed** (91/91 tests, 7.9 minutes, including its fresh production build). These results supersede the earlier 321-unit / 87-e2e pass.
- Failures fixed during implementation: body/physical-coordinate assertions and endpoint precision; S07 footer incorrectly extending the scroll range; capture query loss on navigation; cold-seek state cleared by native scroll echoes; particle shader harness entry compatibility. Rendering review also corrected transparency shader invalidation and kept procedural float gated by robot state. No new refactor was started during final verification.
- Screenshot baselines: **none changed**. All 10 generated e2e screenshot overwrites were restored byte-for-byte to HEAD after the final round 2 run; their Git diff is empty. Review-only captures remain in ignored `captures/mo1-review/`.
- New coverage: tail/body/head mapping; derived hero/Director/seek coordinates; all six ownership seams ±ε; deterministic snapshots with explicit clocks; reduced heroes; ambient envelopes; readiness without consuming t; cold-seek scroll echoes; portal/composer/opacity consumers. Browser coverage includes capture hooks, focus/keyboard navigation, held readiness, reverse boundaries, context recovery and GPU particle math on SwiftShader.
- **Review:** Gemini 4 Carbon returned REJECT; all 13 findings are addressed below. These are builder fixes awaiting independent re-review, not a claim of Carbon approval. Muse's accepted inventory corrections and its DOM/CSS route / immediate nav-close notes remain intact.
- Full GSAP Director transport/site-wide rebuild is deferred by this card's explicit §5.8 boundary; only timing, hero targets and control-layer integration changed. New portal/dissolve visuals, v2 manifest hero parity, lighting rigs and scene bodies remain later cards.
- S07 retains 45 vh of body; its CTA is pinned throughout that span, and Director now gives it a table-derived 1125 ms final dwell. S03/S05 retain their internal visit proportions, with shorter absolute body distances. No real-device motion or frozen pixel/video parity claim is made; the configured `test:e2e` excludes `@gpu` cases.

## Files changed

New foundations: `src/experience/{RuntimeContext.ts,clocks.ts,ease.ts,overlays.tsx,presentation.ts,scroll-map.ts,transitions/beats.ts}`.

Runtime integration (plus `src/experience/{ambient.ts,robot/placement.ts,timemachine/TimeMachine.tsx}`): `src/experience/{Host.tsx,ExperienceMount.tsx,ExperienceControls.tsx,contracts.ts,controller.ts,director.ts,runtime.ts,store.ts,camera/CameraRig.ts,transitions/index.ts,robot/Robot.tsx,robot/compose.ts,robot/intro.ts}`; `src/components/ui/SkipIntro.tsx`; `app/[locale]/{page.tsx,page.module.css}`.

Scene/particle integration (plus `scenes/s03/StationPanel.tsx`, `scenes/s06/DnaPanel.tsx`, `scenes/s07/FuturePanel.tsx` and both S06/S07 panel styles under `src/experience/`; `src/experience/LivingCursor.tsx`): `src/experience/scenes/{s01/scene.ts,s02/index.tsx,s02/scene.ts,s03/scene.ts,s04/index.tsx,s04/scene.ts,s05/GalleryPanel.tsx,s05/gallery.ts,s05/index.tsx,s05/scene.ts,s05/worlds/motion.ts,s06/index.tsx,s06/scene.ts,s07/index.tsx,s07/scene.ts}`; `src/experience/shared/particles/{ParticleField.tsx,core.ts,shaders.ts}`.

Tests: `tests/unit/{motion-foundations,assembly,controller,experience,gallery,s01,s02,transitions}.test.ts`; `tests/e2e/{motion-foundations.spec.ts,motion-helpers.ts,sound-and-motion.spec.ts,experience.spec.ts,s01.spec.ts,s02.spec.ts,s04.spec.ts,transitions.spec.ts,fixtures/particles-gpu.ts}`. Annexes: `doc-annex/{MO-1-site-motion.md,MO-1-report.md}`. Generated screenshot overwrites are excluded from the deliverable.

## Carbon review

Round 1 builder dispositions follow. Carbon re-review verified 12/13 fixed and finding 1 partly fixed; the regressions and corrected final behavior are documented in Carbon review round 2 below. No independent approval is claimed. Runtime evidence paths below are relative to `src/experience/` unless prefixed with `tests/` or `app/`. Historical round 1 gates: 321 unit tests, 122 static pages built, 87/87 e2e tests (7.3 minutes); superseded by round 2 below. No screenshot baselines changed. Builder disposition is ready for independent re-review; no Carbon approval is claimed.

| # | Disposition and evidence |
| --- | --- |
| 1 | Superseded by round 2: the original fixed-panel change restored viewport placement but introduced wheel trapping and focus timing regressions. S06 now uses normal document flow with a table-derived arrival offset; S07 keeps its compact pinned CTA layout without a nested scroll container. See the round 2 evidence and regressions below. |
| 2 | Fixed: `Host.tsx` publishes `transition.owner ?? runtime.scene` and that owner's registration patch both on explicit samples and every SampleFrame. Background CSS, active panels, particles and audio now share the opaque seam; browser tests traverse it forward and backward. Evidence: `Host.tsx:44`, `Host.tsx:66`. |
| 3 | Fixed: `runtime.ts` samples table-derived station/project held points from explicit selection in reduced motion. StationPanel updates selection before seeking; S05 no longer needs its store-patch exemption. Unit and browser tests select all six services and all six open still project worlds. Evidence: `runtime.ts:64`, `scenes/s03/StationPanel.tsx:13`. |
| 4 | Fixed: reverse preload measures distance from the current hero, the reverse jump entry (`transitions/index.ts`). The replacement test first proves a real body position mounts only one scene, then expects the previous scene to preload, and checks the >100 vh cutoff. Evidence: `transitions/index.ts:80`. |
| 5 | Fixed: Hidden Factory portals to document.body (`ExperienceControls.tsx`). Browser test measures its bounds against the whole viewport. Evidence: `ExperienceControls.tsx:71`. |
| 6 | Fixed: synchronous scroll samples preserve/recompute readiness loading before applying overlays (`Host.tsx`). The delayed-model test scrolls past wash-out and reads opaque wash/pulse state synchronously before another rAF. Evidence: `Host.tsx:274`, `overlays.tsx:97`. |
| 7 | Fixed: Director's final dwell derives from TOTAL_BUDGET minus S07 hero, giving 1125 ms. Timer/Next/Skip advances use seek(target,0,false), preserving control focus and history length. Browser fake-clock coverage checks S07 is still playing after 500 ms, then exits after its dwell. Evidence: `director.ts:18`, `ExperienceControls.tsx:28`. |
| 8 | Fixed: Host consumes an initial-attach flag per pathname; controller focuses only an initial hash entry without saved narrative history. Unit re-attach and browser MotionSwitch/modal-focus tests cover the regression. Evidence: `controller.ts:208`, `Host.tsx:278`. |
| 9 | Fixed: Host alone writes the main scene background. Robot root position/quaternion are each committed once from shared placement or transition intents. The paused wash timeline is a linear opacity consumer of transition.wash, with readiness forcing 1 (`overlays.tsx`). Evidence: `Host.tsx:165`, `robot/Robot.tsx:95`, `overlays.tsx:97`. |
| 10 | Fixed: S03/S05 hold their last body robot placement; S03 retains its final station light and S05 retains its final gate/world/gesture. Cross-scene robot placement blends now belong to transition intents using the pure `robot/placement.ts` helper. S02's unused lab-shell clone was removed; the preview keeps the original shell. Endpoint tests protect the held source pose. Evidence: `scenes/s03/scene.ts:53`, `scenes/s05/scene.ts:44`, `robot/placement.ts:17`. |
| 11 | Fixed: omitted capture intro defaults to INTRO_END+.15 and respects cancellation. Explicit URL/programmatic intro samples remain repeatable overrides (`clocks.ts`, `runtime.ts`); unit tests cover completed hero, cancellation and explicit Sleep. Evidence: `clocks.ts:7`, `runtime.ts:61`. |
| 12 | Fixed: non-owner portals start hidden and timelines initialize in layout effect; S01 initial copy is revealed until Host samples it. Scene timeline wrappers pass pointer events through except interactive children, and LivingCursor recognizes portaled scene ancestors. Evidence: `overlays.tsx:74`, `LivingCursor.tsx:25`. |
| 13 | Fixed: effect cleanup clears replay.active; mobile resize derives S07 span from its budget; resolveBeats aligns implicit dissolve end with an overridden dive; fully covered scene composition avoids changing opaque material shader variants. New tests cover the invariant, shader version stability, viewport visibility, selection and dwell. Evidence: `Host.tsx:389`, `controller.ts:144`, `transitions/beats.ts:21`, `presentation.ts:41`. |

Verification corrections: removed duplicate panel declarations, scoped heading/MotionSwitch selectors away from the closed Time Machine and footer controls, updated obsolete gallery endpoint assertions to require a held Gate 6 pose/world, and allowed the six real reduced-motion model selections their measured loading time. Ownership guards still pass; no assertions were removed to conceal a runtime failure. The first full Carbon follow-up browser run passed 86/87; the existing English reduced-motion content-page test failed on 15 ERR_NAME_NOT_RESOLVED image requests. A local DNS lookup also timed out. Both locale variants now fixture only the production project-image CDN with a local poster, retaining all console-error, content-visibility and sound assertions; local assets/scripts remain unmocked.

Additional visible changes from the review fixes: S06 enters below navigation and then scrolls naturally with the page; S07 remains on screen below navigation; S07 mobile choices use two columns in full motion; reduced users can change all service/project still views; Factory covers the full viewport; last S03/S05 body frames hold instead of exiting early; source/destination DOM switches under full wash; default capture opens on the completed hero; Director retains control focus and gives S07 a nonzero dwell. No new visual assets or dependencies.

## Carbon review round 2

All four new findings are accepted and fixed; none are disputed. Final full gates passed: check (323 tests / 37 files), build (122 static pages), e2e (91/91 tests, 7.9 minutes), all with CI=true. These are builder results ready for independent re-review; no Carbon approval is claimed. The earlier Carbon review table is historical where round 2 supersedes it.

| Finding | Final change and evidence |
| --- | --- |
| 1 - scroll trapping | S06 is in normal document flow; its top padding derives the 55 vh arrival tail from SCROLL_MAP plus the navigation clearance. It has no fixed positioning, nested overflow or scroll containment. S07 has no scrolling/containment, passes pointer events through its noninteractive surface, and keeps options/CTA clickable. Evidence: `scenes/s06/DnaPanel.tsx:45`, `scenes/s06/panel.module.css:181`, `scenes/s07/panel.module.css:210`. Wheel tests at 1280x800 and 390x844 assert both scrollY and narrative progress advance through S05/S06/S07 and back, including wheel input over both fully opaque owner seams. S06 viewport checks now apply to its hero; body content scrolls naturally. S07 retains all four body-position viewport/click checks. |
| 2 - heading focus | focusHeading synchronously clears the destination scene panel's inert state and sets data-active before calling focus, after seek has published the correct owner. Nav S06/S07, hash history, CTA and End focus are covered in the browser. Evidence: `controller.ts:179`. |
| 3 - modal page keys | Global page-navigation keys yield to modal interaction, body scroll lock, dialogs, sliders and the open nav panel. Time Machine portals to document.body so scene visibility/inert state cannot hide an open modal. Browser coverage opens it, focuses its slider, sends PageDown/End, asserts unchanged page position/progress and visible open dialog, then closes with Escape and verifies the lock clears. Evidence: `controller.ts:187`, `timemachine/TimeMachine.tsx:75`. |
| 4 - ambient rewind | ambientAngle wraps each running angular offset to +/-pi before weighting; S05 spinners and S07 shapes/core use it. Screen animation retains its unscaled clock and fades the rendered result toward canonical texture 0 through a shader uniform, avoiding both rewound indices and a discontinuous texture-pair switch. This uses an existing texture with one additional sampler lookup; no assets/dependencies. Unit tests sample long times and several weights, bound angular displacement, and require identical screen indices/mix across weights. Evidence: `ambient.ts:2`, `scenes/s05/worlds/motion.ts:24`, `scenes/s05/gallery.ts:8`, `scenes/s07/index.tsx:89`, `scenes/s07/scene.ts:89`. |

Visible changes: S06 content scrolls with the page after entering below navigation; S07 no longer captures page gestures; navigation focus lands on S06/S07 headings; Time Machine remains visible and owns page keys; jump ambient settling fades canonical screens and bounded angular offsets instead of rewinding. Browser wheel tests use desktop and mobile viewport sizes; no physical touch-device claim is made.

Verification corrections: the first focused run passed viewport/focus/modal cases, while the new wheel test had a page.evaluate argument-scope error. It was fixed by passing the argument explicitly and waiting for each native wheel delta to settle. Both wheel cases then passed. Final check/build/e2e results are green as recorded above. No screenshot baselines changed; 10 generated overwrites were restored to HEAD. No commit or push.
