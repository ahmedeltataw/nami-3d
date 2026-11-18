# MO-7a — Jump Capture CLI & Scene-Jump Regression Suite Report

## 1. Deliverables Completed

### 1.1 Jump Capture CLI & Helpers (`scripts/capture-jumps.mjs`, `scripts/capture-jumps.d.mts`, `package.json`)
- **`package.json`**: Added `"capture:jumps": "node scripts/capture-jumps.mjs"`.
- **`scripts/capture-jumps.mjs` + `scripts/capture-jumps.d.mts`**:
  - Models the 7 scenes (`s01`..`s07`) and 6 jump boundaries (`s01->s02`, `s02->s03`, `s03->s04`, `s04->s05`, `s05->s06`, `s06->s07`) from the canonical scroll map (`180, 240, 540, 320, 480, 420, 100` vh = `2280` vh total; `55` vh source head + `55` vh destination tail = `110` vh per jump).
  - Default normalized jump progress sample set: `DEFAULT_JUMP_T = [0, 0.15, 0.30, 0.50, 0.53, 0.59, 0.60, 0.78, 1.0]`.
  - Default directions: `CAPTURE_DIRECTIONS = ['forward', 'reverse', 'direct-seek']`.
  - Freezes ambient and intro clocks via `?capture=1&ambient=<sec>&intro=<sec>&experienceDebug=1` and `window.__namiCapture({ ambientTime, introTime })`.
  - Waits for `[data-experience][data-ready="true"]`, `!debug.loading`, `debug.robotReady`, expected `mountedScenes`, post-mount async scene/asset readiness (`S06_Logo` + `ParticleField` uniforms for `s06`; `Gallery.setWorld` + active `PortalSurface` render target for `s05`), and settled WebGL RGBA frame hashes (throwing if `includePng` is enabled and the frame fails to settle or encode a non-empty PNG) before writing PNGs.
  - Emits per-boundary `captures/<slug>/manifest.json` (with `sha256`, `canvasSha256`, `pixelHash`, `colorCount`, `owner`, `scene`, `cameraZ`, `washOpacity`, `transitionProgress`, and `parity.allMatch`), `captures/index.json`, and `captures/frames.json` with POSIX forward-slash relative paths (`contactFrameRelativePath`, compatible with `scripts/contact-sheet.mjs` from MO-7b).

### 1.2 Unit Tests (`tests/unit/capture-jumps.test.ts`)
- Verifies `SCROLL_BUDGETS`, `JUMPS`, `JUMP_IDS`, `JUMP_SLUGS`, `DEFAULT_JUMP_T`, `CAPTURE_DIRECTIONS`, and `progressForJump` against `SCROLL_MAP` and `TOTAL_BUDGET` from `src/experience/scroll-map.ts`.
- Verifies `resolveJumpTargets`, `formatJumpT`, `captureFrameFileName`, `contactFrameRelativePath`, and `parseTValues`.

### 1.3 Playwright Regression Suite (`tests/e2e/regression/`)
- **`tests/e2e/regression/harness.ts`**: Shared capture-mode page opener (`openCapturePage`), clock setter (`setCaptureClocks`), body/jump frame samplers (`captureAtBody`, `captureAtJump`), and beat boundary helper (`boundaryBeats`).
- **`tests/e2e/regression/determinism.spec.ts`**: Runs 9 body and jump checkpoints with explicit `(progress, ambientTime, introTime)` tuples in forward order, verifies sensitivity to `ambientTime` perturbation on `s04`, then reloads from `about:blank` and traverses in reverse order with perturbed clocks before each sample, asserting identical runtime snapshots, raw RGBA pixel hashes, PNG SHA-256 digests, and PNG byte buffers.
- **`tests/e2e/regression/seams.spec.ts`**: Tests every boundary (`s01->s02` through `s06->s07`):
  - Source exit frame (`b = 1`) matches jump start (`t = 0`).
  - Samples across `washInStart - 0.05`, `opaqueStart ± ε`, `swap ± ε`, `opaqueEnd ± ε`, and `washOutEnd + 0.05` (`ε = 0.005`), asserting `owner` and `data-scene` flip strictly inside the opaque wash interval (`washOpacity === 1`, `data-jump-opaque="true"`) in both forward and reverse directions.
  - Jump end (`t = 1`) matches destination hero frame (`b = 0`).
- **`tests/e2e/regression/cold-seek.spec.ts`**: Scrolls continuously through every jump at `t = 0.30, 0.55, 0.78`, then cold-seeks (`scrollToProgress(p, true)`) into every jump in non-adjacent boundary order `[0, 3, 1, 4, 2, 5]` (ensuring neither `from` nor `to` is mounted prior to the cold seek) and rotated `t` order, asserting identical `owner`, `scene`, `cameraZ`, `washOpacity`, RGBA pixel hash, and PNG bytes.
- **`tests/e2e/regression/overlays.spec.ts`**: Verifies mid-jump (`t = 0.12, 0.30, 0.55, 0.85`) across all 6 boundaries that DOM overlays (`[data-scene-timeline]`) and inactive `[data-scene-panel]` elements are `inert`, cannot receive focus, cannot be hit via `elementFromPoint`, and hold `opacity === 0` across `t ∈ [0.25, 0.75]`; also verifies ordinary scroll never moves focus, while header nav links, skip link, S01 CTAs, `PageDown`/`PageUp`/`Home`/`End`, and history `back`/`forward` land on `b = 0` (`transition = null`) and focus the destination heading.
- **`tests/e2e/regression/capture-matrix.spec.ts`**: Tagged `@gpu` so default `pnpm test:e2e` (`--grep-invert @gpu`) stays fast while full-matrix capture can be invoked on demand.

---

## 2. Commands Run & Verification Results

1. **Lint, Typecheck & Unit Tests**:
   ```bash
   pnpm check
   ```
   - `pnpm lint` (`eslint .`): **PASS** (0 errors, 0 warnings)
   - `pnpm typecheck` (`tsc --noEmit`): **PASS** (0 errors)
   - `pnpm test` (`vitest run`): **PASS** (40 test files, 346 tests passed, including `tests/unit/capture-jumps.test.ts`)

2. **Production Build**:
   ```bash
   npm run build
   ```
   - **PASS** (122 static pages generated)

3. **Jump Captures (Single Pair First, Then Remaining Pairs)**:
   ```bash
   node scripts/capture-jumps.mjs --jump "s01->s02" --out captures
   node scripts/capture-jumps.mjs --jump "s02->s03,s03->s04" --out captures
   node scripts/capture-jumps.mjs --jump "s04->s05,s05->s06" --out captures
   node scripts/capture-jumps.mjs --jump "s06->s07" --out captures
   ```
   - **PASS**: All 6 boundaries captured (`27` frames per boundary = `162` PNG frames total; `parity.allMatch = true` across `forward`, `reverse`, and `direct-seek` for every boundary).

4. **Playwright Scene-Jump Regression Suite (3 Consecutive Runs)**:
   ```bash
   node scripts/run-e2e.mjs tests/e2e/regression --grep-invert "@gpu" --workers=1
   ```
   - Run 1 of 3: **PASS** (`4/4` tests passed: `cold-seek.spec.ts`, `determinism.spec.ts`, `overlays.spec.ts`, `seams.spec.ts`)
   - Run 2 of 3: **PASS** (`4/4` tests passed: `cold-seek.spec.ts`, `determinism.spec.ts`, `overlays.spec.ts`, `seams.spec.ts`)
   - Run 3 of 3: **PASS** (`4/4` tests passed: `cold-seek.spec.ts`, `determinism.spec.ts`, `overlays.spec.ts`, `seams.spec.ts`)

5. **Baseline Screenshots (`tests/e2e/__screens__/*.png`)**:
   - Untouched (`git status --short` shows no modifications to `tests/e2e/__screens__/*.png`).

---

## 3. Evidence Paths (Gitignored `captures/`)

All evidence images and manifests are stored under gitignored `captures/` (outside git tracking):

- Index & Contact-Sheet Input Manifests:
  - `captures/index.json`
  - `captures/frames.json`
- Per-Jump Manifests & Frame Directories (`27` PNGs each: `{forward,reverse,direct-seek}-t{0.00,0.15,0.30,0.50,0.53,0.59,0.60,0.78,1.00}.png`):
  - `captures/s01-s02/manifest.json` (`27` frames, `allMatch: true`)
  - `captures/s02-s03/manifest.json` (`27` frames, `allMatch: true`)
  - `captures/s03-s04/manifest.json` (`27` frames, `allMatch: true`)
  - `captures/s04-s05/manifest.json` (`27` frames, `allMatch: true`)
  - `captures/s05-s06/manifest.json` (`27` frames, `allMatch: true`)
  - `captures/s06-s07/manifest.json` (`27` frames, `allMatch: true`)
- Contact Sheets (`captures/sheets/`):
  - `captures/sheets/S01-S02-jump-S01-S02.png`
  - `captures/sheets/S02-S03-jump-S02-S03.png`
  - `captures/sheets/S03-S04-jump-S03-S04.png`
  - `captures/sheets/S04-S05-jump-S04-S05.png`
  - `captures/sheets/S05-S06-jump-S05-S06.png`
  - `captures/sheets/S06-S07-jump-S06-S07.png`
