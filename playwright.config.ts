import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT || 3100);
export default defineConfig({
  testDir: './tests/e2e',
  workers: process.env.CI ? 2 : undefined,
  expect: { timeout: 10_000 },
  use: { baseURL: `http://127.0.0.1:${port}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } } }],
  webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVER === '1' ? undefined : { command: `pnpm build && pnpm start --port ${port}`, url: `http://127.0.0.1:${port}`, reuseExistingServer: false, timeout: 120_000 },
});
