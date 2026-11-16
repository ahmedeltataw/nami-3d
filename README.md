# Nami 3D

Requires Node.js 24 or newer and pnpm 10.28.2 (`corepack enable`).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Visit `/ar` or `/en`; `/` redirects to Arabic. Run `pnpm check` for lint, types and unit tests, `pnpm build` for a production build, and `pnpm exec playwright install chromium` followed by `pnpm test:e2e` for browser tests. The browser suite builds and starts the production app on an available local port.

Robot grab intent is exposed as `useExperienceStore.getState().cursorGrab`; TODO: connect this intent to the robot composer when grab posing is supported.

Scene assets and residency owners live in each scene's `assets.ts`; scene state lives in its `store.ts`, and its component and snapshot updates are registered in `registration.ts`. Add one import and one entry per scene to the central registries. Translations live in `src/messages/<namespace>.<locale>.json`; register a new namespace in `src/i18n/messages.ts`. The retained `ar.json` and `en.json` provide shared base messages.

Copy client reference images locally from `D:\website\Nami-3D\briefs\refs\S0N.png` to `public/_refs/S0N.png` (ignored by Git). In development, use `/ar?debug=reference&scene=S01&opacity=0.5` and `[` / `]` to change opacity by 0.05. For a preview production build, set `NEXT_PUBLIC_DEBUG_TOOLS=1` at build time; normal production builds exclude the overlay module.

Run `node scripts/gpu-capture.mjs --card R1 --scene S01 --progress 0,0.3,0.6` after building. It starts the production app on an available port, uses installed Chrome or bundled Chromium with GPU acceleration, and saves both viewport captures and renderer metadata in ignored `captures/R1/`. Add `--headed` for a visible browser, `--url http://127.0.0.1:3000/ar` to use an existing server, or `--compare public/_refs/S01.png` for side-by-side PNGs. SwiftShader is rejected. `pnpm test:e2e` excludes the heavy `@gpu` references; `pnpm test:gpu` runs those tests with the same real GPU launch flags.
