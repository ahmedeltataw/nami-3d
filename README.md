# Nami 3D

Requires Node.js 24 or newer and pnpm 10.28.2 (`corepack enable`).

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Visit `/ar` or `/en`; `/` redirects to Arabic. Run `pnpm check` for lint, types and unit tests, `pnpm build` for a production build, and `pnpm exec playwright install chromium` followed by `pnpm test:e2e` for browser tests. The browser suite builds and starts the production app on an available local port.

Robot grab intent is exposed as `useExperienceStore.getState().cursorGrab`; TODO: connect this intent to the robot composer when grab posing is supported.
