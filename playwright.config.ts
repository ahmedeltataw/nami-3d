import { defineConfig, devices } from '@playwright/test';
import { gpuArgs, systemChromeChannel } from './scripts/gpu-browser.mjs';

const port = Number(process.env.PLAYWRIGHT_PORT || 3100);
const swiftshader = process.env.PLAYWRIGHT_GPU !== '1';
export default defineConfig({
  testDir: './tests/e2e',
  workers: process.env.CI ? 1 : undefined,
  timeout: swiftshader ? 120_000 : 60_000,
  expect: { timeout: swiftshader ? 30_000 : 15_000 },
  use: { baseURL: `http://127.0.0.1:${port}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], launchOptions: process.env.PLAYWRIGHT_GPU === '1' ? { channel: systemChromeChannel(), args: gpuArgs } : { args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] } } }],
  webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVER === '1' ? undefined : { command: `pnpm build && pnpm start --port ${port}`, url: `http://127.0.0.1:${port}`, reuseExistingServer: false, timeout: 120_000 },
});
