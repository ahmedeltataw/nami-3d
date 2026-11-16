import { expect, test } from '@playwright/test';
import { buildParticlesHarness } from './fixtures/build-particles.mjs';

let bundle: string;
test.beforeAll(async () => { bundle = await buildParticlesHarness(); });

test('S02 particles render on SwiftShader, mirror GPU math, seek, respect profiles and dispose', async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.setViewportSize({ width: 960, height: 640 });
  await page.route('**/__particles_test__', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><link rel="icon" href="data:,"></head><body style="margin:0;background:#101b18"><div id="root" style="width:100vw;height:100vh"></div><script src="/__particles_test__.js"></script></body></html>' }));
  await page.route('**/__particles_test__.js', route => route.fulfill({ contentType: 'application/javascript', body: bundle }));
  await page.goto('/__particles_test__');
  await expect.poll(() => page.evaluate(() => window.particlesHarness?.metrics().rendered)).toBe(20_000);
  expect(await page.evaluate(() => window.particlesHarness.pixels())).toBeGreaterThan(2000);
  expect(await page.evaluate(() => window.particlesHarness.metrics().dpr)).toBe(2);
  const renderer = await page.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    const gl = canvas.getContext('webgl2')!;
    const extension = gl.getExtension('WEBGL_debug_renderer_info')!;
    return gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) as string;
  });
  expect(renderer).toContain('SwiftShader');
  await page.locator('canvas').screenshot({ path: 'tests/e2e/__screens__/particles.png' });
  const gpuErrors = await page.evaluate(() => window.particlesHarness.gpuErrors());
  await test.info().attach('gpu-reference-errors', { body: JSON.stringify(gpuErrors), contentType: 'application/json' });
  // GLSL sin/cos and Float32 arithmetic differ slightly from JavaScript doubles.
  expect(Math.max(...gpuErrors)).toBeLessThan(0.0005);
  expect(gpuErrors[4]).toBe(0); // Converge at progress 0.
  expect(gpuErrors[7]).toBe(0); // Converge at progress 1.

  await page.evaluate(() => { window.particlesHarness.replaceTargets(); window.particlesHarness.frame.progress = 1; });
  await expect.poll(() => page.evaluate(() => window.particlesHarness.metrics().progress)).toBe(1);
  await page.evaluate(() => { window.particlesHarness.frame.progress = 0; });
  await expect.poll(() => page.evaluate(() => window.particlesHarness.metrics().progress)).toBe(0);

  await page.evaluate(() => window.particlesHarness.configure({ active: false }));
  await expect.poll(() => page.evaluate(() => window.particlesHarness.metrics().visible)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.particlesHarness.metrics().rendered)).toBe(0);
  await page.evaluate(() => {
    window.particlesHarness.configure({ active: true, profile: { quality: 'high', motion: 'reduced', renderer: 'webgl' } });
    window.particlesHarness.frame.time = 900;
    window.particlesHarness.frame.progress = 0.6;
  });
  await expect.poll(() => page.evaluate(() => window.particlesHarness.metrics().time)).toBe(0);
  await expect.poll(() => page.evaluate(() => window.particlesHarness.metrics().progress)).toBe(0.6);
  for (const quality of ['mid', 'low'] as const) {
    await page.evaluate(quality => window.particlesHarness.configure({ profile: { quality, motion: 'full', renderer: 'webgl' } }), quality);
    await expect.poll(() => page.evaluate(() => window.particlesHarness.metrics().rendered)).toBe(quality === 'mid' ? 8000 : 2500);
  }
  await page.evaluate(() => { window.particlesHarness.watchDisposal(); window.particlesHarness.configure({ seed: 43 }); });
  await expect.poll(() => page.evaluate(() => window.particlesHarness.metrics().geometryDisposals)).toBeGreaterThan(0);
  await expect.poll(() => page.evaluate(() => window.particlesHarness.metrics().materialDisposals)).toBeGreaterThan(0);
  const disposed = await page.evaluate(() => window.particlesHarness.metrics());
  await page.evaluate(() => { window.particlesHarness.watchDisposal(); window.particlesHarness.fallbackOutsideCanvas(); });
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(await page.evaluate(() => window.particlesHarness.metrics().geometryDisposals)).toBeGreaterThan(disposed.geometryDisposals);
  expect(await page.evaluate(() => window.particlesHarness.metrics().materialDisposals)).toBeGreaterThan(disposed.materialDisposals);
  await page.evaluate(() => window.particlesHarness.unmount());
  expect(errors).toEqual([]);
});
