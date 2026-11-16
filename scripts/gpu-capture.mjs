import { chromium, expect } from '@playwright/test';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import next from 'next';
import { gpuArgs, systemChromeChannel } from './gpu-browser.mjs';

const { values } = parseArgs({ options: {
  card: { type: 'string' }, scene: { type: 'string' }, progress: { type: 'string', default: '0,0.3,0.6' },
  compare: { type: 'string' }, url: { type: 'string' }, headed: { type: 'boolean', default: false },
} });

async function productionServer() {
  if (!existsSync('.next/BUILD_ID')) {
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'build'], { stdio: 'inherit' });
      child.once('error', reject);
      child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Build failed: ${code}`)));
    });
  }
  process.env.NODE_ENV = 'production';
  const app = next({ dev: false, hostname: '127.0.0.1' });
  await app.prepare();
  const server = createServer(app.getRequestHandler());
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    url: `http://127.0.0.1:${server.address().port}/ar`,
    async close() {
      server.closeAllConnections();
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      await app.close();
    },
  };
}

async function compare(browser, capture, reference, viewport, path) {
  const page = await browser.newPage({ viewport: { width: viewport.width * 2, height: viewport.height }, deviceScaleFactor: 1 });
  try {
    await page.setContent('<style>html,body{margin:0;display:flex;background:white}img{object-fit:contain;flex:none}</style>');
    await page.evaluate(({ capture, reference, width, height }) => {
      for (const [name, source] of [['capture', capture], ['reference', reference]]) {
        const image = document.createElement('img');
        image.alt = name; image.width = width; image.height = height; image.src = source;
        document.body.append(image);
      }
    }, { capture: `data:image/png;base64,${capture.toString('base64')}`, reference: `data:image/png;base64,${reference.toString('base64')}`, ...viewport });
    await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    await page.screenshot({ path });
  } finally { await page.close(); }
}

async function main() {
  if (!values.card || !/^[\w-]+$/.test(values.card)) throw new Error('--card must contain only letters, numbers, underscores or hyphens');
  const scene = values.scene?.toLowerCase();
  if (!/^s0[1-7]$/.test(scene ?? '')) throw new Error('--scene must be S01 through S07');
  const progress = values.progress.split(',').map(Number);
  if (!progress.length || values.progress.split(',').some(value => !value.trim()) || progress.some(value => !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new Error('--progress must be comma-separated numbers from 0 to 1');
  }
  const reference = values.compare ? await readFile(resolve(values.compare)) : null;
  const directory = join('captures', values.card);
  await mkdir(directory, { recursive: true });
  const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  let server;
  let browser;
  try {
    server = values.url ? null : await productionServer();
    browser = await chromium.launch({ channel: systemChromeChannel(), headless: !values.headed, args: gpuArgs });
    const renderers = [];
    for (const viewport of [{ width: 1672, height: 941 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
      page.setDefaultTimeout(60_000);
      const url = new URL(values.url ?? server.url);
      url.hash = scene;
      await page.goto(url.href);
      const host = page.locator('[data-experience]');
      await expect(host).toHaveAttribute('data-renderer', 'webgl', { timeout: 60_000 });
      await expect(host).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
      await page.waitForFunction(() => !!window.__namiController);
      await page.evaluate(() => document.fonts.ready);
      const gpu = await page.locator('[data-experience] canvas:not([data-s01-energy-line])').evaluate(canvas => {
        const gl = canvas.getContext('webgl2');
        const extension = gl?.getExtension('WEBGL_debug_renderer_info');
        if (!gl || !extension) throw new Error('WEBGL_debug_renderer_info unavailable on the scene canvas');
        return { renderer: gl.getParameter(extension.UNMASKED_RENDERER_WEBGL), vendor: gl.getParameter(extension.UNMASKED_VENDOR_WEBGL) };
      });
      if (/swiftshader/i.test(gpu.renderer)) throw new Error(`Real GPU required; received ${gpu.renderer}`);
      renderers.push({ ...gpu, viewport });
      await writeFile(join(directory, 'gpu.json'), JSON.stringify({ ...gpu, timestamp: new Date().toISOString(), sha, renderers }, null, 2) + '\n');
      for (const local of progress) {
        await page.evaluate(({ scene, local }) => window.__namiController.seek(scene, local, false), { scene, local });
        await page.waitForFunction(({ scene, local }) => {
          const position = window.__namiController?.position();
          return position?.scene === scene && Math.abs(position.local - local) < 0.00001;
        }, { scene, local });
        await expect(host).toHaveAttribute('data-scene', scene);
        await expect(host).toHaveAttribute('data-ready', 'true', { timeout: 60_000 });
        await expect(page.locator('[data-scene-canvas]')).toHaveCSS('opacity', '1');
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        const name = `${scene.toUpperCase()}-p${local}-${viewport.width}x${viewport.height}.png`;
        const capture = await page.screenshot({ path: join(directory, name) });
        if (reference) await compare(browser, capture, reference, viewport, join(directory, `compare-${name}`));
        console.log(join(directory, name));
      }
      await page.close();
    }
    console.log(`GPU: ${renderers[0].renderer}`);
  } finally {
    await browser?.close();
    await server?.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
