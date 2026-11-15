import { expect, test } from '@playwright/test';

test('WebGL context is available (SwiftShader)', async ({ page }) => {
  await page.goto('/en');
  const ok = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  });
  expect(ok).toBe(true);
});
