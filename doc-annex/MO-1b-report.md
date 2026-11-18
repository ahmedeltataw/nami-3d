# MO-1b review follow-ups

Branch `task/MO-1b`, merged baseline `6be0b0e7` (includes MO-1c PR #46). No commit or push.

- **S05 screens:** `Gallery` initializes each `uCanonical` from its plane's phased slot, modulo the available screen count. Unit coverage checks all six worlds at ambient weight zero and in reduced motion.
- **Fallback navigation:** shared `noJumps(profile)` (`profile.ts:7`) disables jumps for reduced motion or the fallback renderer. Controller mapping, runtime evaluation, transition sampling, residency selection and Host/DOM overlays all consume that policy. Full-motion fallback remains full motion in `data-motion`, seeks without the arrival-tail offset, publishes the requested scene, and leaves wash opacity at zero with the loader hidden.
- **Runtime error fallback:** `syncRuntimeProfile` (`runtime.ts:55`) merges configuration with the store's live renderer before controller creation in Host. The existing controller effect depends on renderer, so an asset/Canvas error rebuilds it with the fallback profile even while ExperienceMount configuration still says WebGL. The configured object is preserved.

The new unit assertions reproduced both original production failures with the corresponding fixes temporarily reverted.

## Carbon review follow-up

The blocker and major finding are accepted and fixed; the accepted S05 canonical-screen implementation is unchanged. No changes were made to `tests/e2e/motion-foundations.spec.ts` (MO-1c ownership).

Regression proof before the fix:

- New fallback controller/runtime unit coverage failed at S02 with an incoming `s01->s02` transition at t=0.5 and owner S01.
- Updated denied-WebGL E2E failed because `[data-experience]` published S01 after an S02 seek.
- Runtime-error unit mutation check: reinstating `runtime.profile = configured` failed with WebGL instead of fallback; the tested merge was restored before final validation.
- New asset-error E2E aborted a real robot model request, triggered fallback after WebGL detection, and failed because the next section seek retained a 396 px arrival offset.

Coverage now includes all six S02-S07 fallback nav/hash seeks, published DOM scene, zero wash opacity, hidden loader and un-offset section alignment; the runtime-error unit simulates the live renderer change, preserves stale WebGL configuration, rebuilds the controller, and checks mapping, null transitions and single-scene residency. The existing per-plane canonical tests remain intact.

## Final validation - 2026-11-18

All commands ran in `D:\website\Nami-3D\.worktrees\MO-1b`, using Windows `pnpm.cmd` with the requested Node/npm directories prepended to `PATH`.

- `pnpm check`: **passed**, including ESLint, TypeScript, and **39 unit-test files / 353 tests**.
- `pnpm build`: **passed**, generating **122/122 static pages**, with temporary `NODE_OPTIONS=--max-old-space-size=4096`.
- `CI=1 pnpm test:e2e --workers=1`: **92 passed (13.3m)**, covering the full non-GPU suite, cold S05 readiness, both fallback regressions, and the merged MO-1c motion-foundations tests. The successful command also used temporary `NODE_OPTIONS=--max-old-space-size=4096` and `CIRCLE_NODE_TOTAL=3`, which selects two Next build workers; Playwright used one worker.

The first full E2E invocation stopped before browser tests launched: its prerequisite build used 11 workers and failed prerendering `/en/projects/jobs-in-saudi` with `Z_MEM_ERROR: insufficient memory`. Next's installed source confirmed that `CIRCLE_NODE_TOTAL` controls the default worker count. Limiting build workers through the command environment resolved that failure; the complete rerun passed. No production code, build configuration, assertions, or timeouts were changed during this validation pass. The earlier write-permission failures did not recur in the passing gates.

Ten screenshot PNGs overwritten by E2E were restored from HEAD. `tests/e2e/motion-foundations.spec.ts` remains unchanged from merged baseline `6be0b0e7` (SHA256 `24359ad0c45a6cdf4e2fe05aa5596002af4482d53858d3e270f0674b9ad87243`). The temporary `MO-1b-validation.md` note was removed, and no `mo1b-e2e-artifacts/` folder remains. No commit or push.

Pre-gate `.next` deletion was rejected by automatic approval review because sandbox approval is disabled, including a narrower single-file cleanup attempt. The other named stale artifacts were absent at initial inspection. The standalone build and successful E2E prerequisite build subsequently rebuilt the generated output. The root-checkout continuation brief was not read because the task expressly forbids file access outside this worktree.
