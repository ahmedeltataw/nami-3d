import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, posix, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import next from 'next';
import { gpuArgs, systemChromeChannel } from './gpu-browser.mjs';

export const SCENE_IDS = ['s01', 's02', 's03', 's04', 's05', 's06', 's07'];
export const SCROLL_BUDGETS = [180, 240, 540, 320, 480, 420, 100];
export const TOTAL_BUDGET = SCROLL_BUDGETS.reduce((sum, value) => sum + value, 0);
export const DEFAULT_JUMP_T = [0, 0.15, 0.30, 0.50, 0.53, 0.59, 0.60, 0.78, 1.0];
export const CAPTURE_DIRECTIONS = ['forward', 'reverse', 'direct-seek'];

function buildJumps() {
  let start = 0;
  const rows = SCENE_IDS.map((id, index) => {
    const budget = SCROLL_BUDGETS[index];
    const tail = index ? 55 : 0;
    const head = index < 6 ? 55 : 0;
    const row = { id, start, budget, tail, body: budget - tail - head, head, hero: start + tail, departure: start + budget - head };
    start += budget;
    return row;
  });
  return rows.slice(0, -1).map((row, boundary) => {
    const next = rows[boundary + 1];
    return {
      boundary,
      id: `${row.id}->${next.id}`,
      slug: `${row.id}-${next.id}`,
      from: row.id,
      to: next.id,
      departure: row.departure,
      length: row.head + next.tail,
    };
  });
}

export const JUMPS = buildJumps();
export const JUMP_IDS = JUMPS.map(jump => jump.id);
export const JUMP_SLUGS = JUMPS.map(jump => jump.slug);

export function formatJumpT(t) {
  const clamped = Math.max(0, Math.min(1, Number(t)));
  return clamped.toFixed(2);
}

export function captureFrameFileName(direction, t) {
  return `${direction}-t${formatJumpT(t)}.png`;
}

export function contactFrameRelativePath(slug, fileName) {
  return posix.join(slug, fileName);
}

export function progressForJump(boundary, t) {
  const jump = typeof boundary === 'number' ? JUMPS[boundary] : JUMPS.find(item => item.id === boundary || item.slug === boundary);
  if (!jump) throw new Error(`Unknown jump boundary: ${String(boundary)}`);
  const clamped = Math.max(0, Math.min(1, Number(t)));
  return (jump.departure + clamped * jump.length) / TOTAL_BUDGET;
}

export function resolveJumpTargets(input = 'all') {
  const raw = String(input ?? 'all').trim();
  if (!raw || raw.toLowerCase() === 'all') return [...JUMPS];
  const tokens = raw.split(',').map(token => token.trim().toLowerCase()).filter(Boolean);
  if (!tokens.length) throw new Error('At least one jump id or "all" is required');
  const resolved = [];
  for (const token of tokens) {
    if (token === 'all') return [...JUMPS];
    const normalized = token.replace(/->|_|:/g, '-');
    const bySlug = JUMPS.find(jump => jump.slug === normalized || jump.id === token);
    const byIndex = /^[0-5]$/.test(token) ? JUMPS[Number(token)] : undefined;
    const match = bySlug ?? byIndex;
    if (!match) {
      throw new Error(`Unknown jump "${token}". Expected one of: all, ${JUMP_IDS.join(', ')}, or ${JUMP_SLUGS.join(', ')}`);
    }
    if (!resolved.some(existing => existing.id === match.id)) resolved.push(match);
  }
  return resolved;
}

export function parseTValues(input) {
  if (!input) return [...DEFAULT_JUMP_T];
  const values = String(input).split(',').map(part => Number(part.trim()));
  if (!values.length || values.some(v => !Number.isFinite(v) || v < 0 || v > 1)) {
    throw new Error(`Invalid --t values "${String(input)}": must be comma-separated numbers in [0, 1]`);
  }
  return values;
}

function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export async function waitForSettledFrame(page, expectedMounted = [], options = {}) {
  const includePng = options.includePng !== false;
  await page.waitForFunction(
    expected => {
      const host = document.querySelector('[data-experience]');
      const debug = window.__namiDebug?.();
      if (!host || host.getAttribute('data-ready') !== 'true' || !debug) return false;
      if (debug.loading || !debug.robotReady) return false;
      if (host.getAttribute('data-scene') !== debug.owner) return false;
      if (debug.mountedScenes.length !== expected.length) return false;
      if (!expected.every(sceneId => debug.mountedScenes.includes(sceneId))) return false;

      const panels = document.querySelectorAll('[data-scene-panel]');
      for (const panel of panels) {
        const isOwner = panel.getAttribute('data-scene-panel') === debug.owner;
        if (panel.getAttribute('data-active') !== String(isOwner)) return false;
        if (Boolean(panel.inert) !== !isOwner) return false;
      }

      if (debug.owner === 's05') {
        const galleryPanel = document.querySelector('[data-gallery-panel]');
        const expectedProject = String(debug.snapshot?.visual?.project ?? 0);
        if (galleryPanel && galleryPanel.getAttribute('data-project') !== expectedProject) return false;
      }

      // Inspect Host fiber state to verify post-mount async scene/asset readiness for s05 and s06.
      const fiberKey = Object.keys(host).find(key => key.startsWith('__reactFiber$'));
      if (fiberKey) {
        let runtime = null;
        let contexts = null;
        const queue = [host[fiberKey]];
        const visited = new Set();
        while (queue.length > 0 && (!runtime || !contexts)) {
          const fiber = queue.shift();
          if (!fiber || visited.has(fiber)) continue;
          visited.add(fiber);
          for (let hook = fiber.memoizedState; hook; hook = hook.next) {
            const state = hook.memoizedState;
            const candidate = Array.isArray(state) ? state[0] : state;
            if (candidate && typeof candidate === 'object') {
              if (!runtime && 'assetsReady' in candidate && 'robotReady' in candidate && 'sceneSnapshots' in candidate) {
                runtime = candidate;
              } else if (!contexts && candidate instanceof Map) {
                contexts = candidate;
              }
            }
          }
          if (fiber.child) queue.push(fiber.child);
          if (fiber.sibling) queue.push(fiber.sibling);
        }

        if (!runtime || !contexts) return false;
        if (!runtime.assetsReady || !runtime.framed || runtime.loading || !runtime.robotReady) return false;

        for (const sceneId of expected) {
          const ctx = contexts.get(sceneId);
          if (!ctx || !ctx.root) return false;

          if (sceneId === 's06') {
            // S06 registers synchronously before lease.ready clones logo.3d and samples LogoProxy.
            const logo = ctx.root.getObjectByName('S06_Logo');
            const particleField = ctx.root.getObjectByName('ParticleField');
            if (!logo || !particleField?.material?.uniforms) return false;
            if (debug.owner === 's06') {
              const s06Snapshot = runtime.presentationSnapshot ?? runtime.sceneSnapshots?.s06 ?? debug.snapshot;
              const expectedLogoVisible = Number(s06Snapshot?.visual?.logoOpacity ?? 0) > 0.001;
              if (Boolean(logo.visible) !== expectedLogoVisible) return false;
            }
            const expectedTime = runtime.profile?.motion === 'reduced' ? 0 : debug.ambientTime;
            if (Math.abs(Number(particleField.material.uniforms.uTime?.value ?? -1) - expectedTime) > 1e-4) {
              return false;
            }
            const expectedAmbientWeight = Number(runtime.ambientWeight ?? 1);
            if (Math.abs(Number(particleField.material.uniforms.uAmbientWeight?.value ?? -1) - expectedAmbientWeight) > 1e-4) {
              return false;
            }
          }

          if (sceneId === 's05') {
            // S05 registers in effect #1 before effect #2 resolves getProjects() + world GLB and calls setWorld().
            const storeProject = Number(document.querySelector('[data-gallery-panel]')?.getAttribute('data-project') ?? 0);
            const s05Snapshot =
              debug.owner === 's05' && runtime.presentationSnapshot
                ? runtime.presentationSnapshot
                : (runtime.sceneSnapshots?.s05 ?? debug.snapshot);
            const s05Visual = s05Snapshot?.visual ?? {
              project: storeProject,
              open: 0,
              activeTarget: null,
              worldProgress: 0,
            };
            const storeGate = ctx.root.getObjectByName(`Gate_${storeProject + 1}`);
            const storeSurface = storeGate?.getObjectByName('PortalSurface');
            if (!storeSurface?.material) return false;

            if (debug.owner === 's05' && typeof s05Visual.activeTarget === 'number') {
              const activeGate = ctx.root.getObjectByName(`Gate_${s05Visual.activeTarget + 1}`);
              const activeSurface = activeGate?.getObjectByName('PortalSurface');
              if (!activeSurface?.material || activeSurface.material.userData?.active !== true || !activeSurface.material.map) {
                return false;
              }
            } else if (typeof ctx.updateGallery === 'function') {
              ctx.updateGallery({ ...s05Visual, project: storeProject, activeTarget: storeProject });
              const worldReady = storeSurface.material.userData?.active === true && Boolean(storeSurface.material.map);
              ctx.updateGallery(s05Visual);
              if (!worldReady) return false;
            }
          }
        }
      }

      return true;
    },
    expectedMounted,
    { timeout: 45_000 },
  );

  const rawResult = await page.evaluate(async ({ wantPng }) => {
    const canvas =
      document.querySelector('[data-scene-canvas] canvas') ??
      document.querySelector('[data-experience] canvas:not([data-s01-energy-line])');
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Scene canvas not found');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) throw new Error('WebGL context unavailable');

    function samplePixels() {
      return new Promise(resolve => {
        requestAnimationFrame(() => {
          const width = gl.drawingBufferWidth;
          const height = gl.drawingBufferHeight;
          const pixels = new Uint8Array(width * height * 4);
          gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
          const words = new Uint32Array(pixels.buffer);
          let hash = 2166136261;
          const colors = new Set();
          for (let i = 0; i < words.length; i++) {
            const w = words[i];
            hash = Math.imul(hash ^ w, 16777619);
            if ((i & 31) === 0 && (w >>> 24) > 0) {
              colors.add(w & 0x00ffffff);
            }
          }
          resolve({
            hash: hash >>> 0,
            colorCount: colors.size,
          });
        });
      });
    }

    let sample = await samplePixels();
    let stableRuns = 0;
    for (let attempt = 0; attempt < 15; attempt++) {
      const next = await samplePixels();
      if (next.hash === sample.hash && next.colorCount > 1) {
        stableRuns++;
        sample = next;
        if (stableRuns >= 2) break;
      } else {
        stableRuns = 0;
        sample = next;
      }
    }
    const settled = stableRuns >= 2 && sample.colorCount > 1;
    let dataUrl = '';
    if (wantPng && settled) {
      dataUrl = await new Promise(resolve => {
        requestAnimationFrame(() => resolve(canvas.toDataURL('image/png')));
      });
    }
    sample = { ...sample, settled, dataUrl };
    if (!sample.settled || sample.colorCount <= 1) {
      throw new Error(`WebGL frame did not settle (settled=${sample.settled}, colorCount=${sample.colorCount})`);
    }
    if (wantPng && !sample.dataUrl) {
      throw new Error('Failed to encode settled WebGL canvas PNG dataUrl');
    }

    const debug = window.__namiDebug?.();
    const washEl = document.querySelector('[data-jump-wash]');
    const washOpacity = washEl ? Number(getComputedStyle(washEl).opacity) : 0;
    return {
      hash: sample.hash,
      colorCount: sample.colorCount,
      settled: sample.settled,
      dataUrl: sample.dataUrl,
      owner: debug?.owner ?? debug?.scene ?? 's01',
      scene: debug?.scene ?? 's01',
      b: debug?.b ?? 0,
      progress: debug?.progress ?? 0,
      cameraZ: debug?.cameraZ ?? 0,
      transition: debug?.transition ?? null,
      washOpacity,
    };
  }, { wantPng: includePng });

  const base64 = rawResult.dataUrl ? (rawResult.dataUrl.split(',')[1] ?? '') : '';
  const canvasPng = base64 ? Buffer.from(base64, 'base64') : Buffer.alloc(0);
  if (includePng && (!rawResult.settled || !rawResult.dataUrl || canvasPng.byteLength === 0)) {
    throw new Error('waitForSettledFrame: expected settled non-empty PNG capture');
  }
  return {
    ...rawResult,
    canvasPng,
    canvasSha256: base64 ? sha256Hex(canvasPng) : '',
  };
}

export async function captureJumpFrames(page, jumpInput, options = {}) {
  const [jump] = resolveJumpTargets(typeof jumpInput === 'string' ? jumpInput : jumpInput.id);
  const ambientTime = Number.isFinite(options.ambientTime) ? Number(options.ambientTime) : 6;
  const introTime = Number.isFinite(options.introTime) ? Number(options.introTime) : 8;
  const tValues = options.tValues ?? DEFAULT_JUMP_T;
  const directions = options.directions ?? CAPTURE_DIRECTIONS;
  const outRoot = resolve(options.outDir ?? 'captures');
  const jumpDir = join(outRoot, jump.slug);
  const writePng = options.writeFiles !== false;
  if (writePng) await mkdir(jumpDir, { recursive: true });

  await page.evaluate(
    ({ ambient, intro }) => {
      window.__namiCapture?.({ ambientTime: ambient, introTime: intro });
    },
    { ambient: ambientTime, intro: introTime },
  );

  const frames = [];

  async function recordAt(direction, t, cold) {
    const progress = progressForJump(jump.boundary, t);
    await page.evaluate(
      ({ targetProgress, isCold, ambient, intro }) => {
        window.__namiCapture?.({ ambientTime: ambient, introTime: intro });
        window.__namiController?.scrollToProgress(targetProgress, isCold);
      },
      { targetProgress: progress, isCold: cold, ambient: ambientTime, intro: introTime },
    );
    const expectedMounted = t >= 1 ? [jump.to] : [jump.from, jump.to];
    const settled = await waitForSettledFrame(page, expectedMounted);
    const file = captureFrameFileName(direction, t);
    const filePath = join(jumpDir, file);
    let fileSha256 = settled.canvasSha256;
    if (writePng) {
      if (options.canvasOnly) {
        await writeFile(filePath, settled.canvasPng);
      } else {
        const screenshotBuffer = await page.screenshot({ path: filePath, animations: 'disabled' });
        fileSha256 = sha256Hex(screenshotBuffer);
      }
    }
    frames.push({
      direction,
      t,
      label: `t=${formatJumpT(t)}`,
      file,
      sha256: fileSha256,
      canvasSha256: settled.canvasSha256,
      pixelHash: settled.hash,
      colorCount: settled.colorCount,
      owner: settled.owner,
      scene: settled.scene,
      cameraZ: settled.cameraZ,
      washOpacity: settled.washOpacity,
      transitionProgress: settled.transition?.progress ?? (t >= 1 ? 1 : 0),
    });
  }

  for (const direction of directions) {
    if (direction === 'forward') {
      await page.evaluate(({ from }) => window.__namiController?.seek(from, 0.9, false), { from: jump.from });
      await waitForSettledFrame(page, [jump.from]);
      await page.evaluate(({ from }) => window.__namiController?.seek(from, 0.98, false), { from: jump.from });
      await waitForSettledFrame(page, [jump.from]);
      for (const t of tValues) {
        await recordAt('forward', t, false);
      }
    } else if (direction === 'reverse') {
      await page.evaluate(({ to }) => window.__namiController?.seek(to, 0.1, false), { to: jump.to });
      await waitForSettledFrame(page, [jump.to]);
      await page.evaluate(({ to }) => window.__namiController?.seek(to, 0, false), { to: jump.to });
      await waitForSettledFrame(page, [jump.to]);
      for (const t of [...tValues].reverse()) {
        await recordAt('reverse', t, false);
      }
    } else if (direction === 'direct-seek') {
      const neutralScene = jump.boundary < 4 ? 's07' : 's01';
      await page.evaluate(({ scene }) => window.__namiController?.seek(scene, 0, false), { scene: neutralScene });
      await waitForSettledFrame(page, [neutralScene]);
      // Seek in non-monotonic order so every t is reached via a direct jump rather than adjacent stepping.
      const seekOrder = tValues.map((_, idx) => tValues[(idx * 5) % tValues.length]);
      const recordedByT = new Map();
      const total = tValues.length;
      const seen = new Set();
      for (const candidate of [...seekOrder, ...tValues]) {
        const key = formatJumpT(candidate);
        if (seen.has(key)) continue;
        seen.add(key);
        await recordAt('direct-seek', candidate, true);
        recordedByT.set(key, frames.pop());
        if (seen.size === total) break;
      }
      for (const t of tValues) {
        const entry = recordedByT.get(formatJumpT(t));
        if (entry) frames.push(entry);
      }
    } else {
      throw new Error(`Unsupported capture direction: ${direction}`);
    }
  }

  const mismatches = [];
  for (const t of tValues) {
    const label = `t=${formatJumpT(t)}`;
    const atT = frames.filter(frame => frame.label === label);
    if (atT.length > 1) {
      const baseline = atT[0];
      for (const other of atT.slice(1)) {
        if (other.canvasSha256 !== baseline.canvasSha256 || other.pixelHash !== baseline.pixelHash) {
          mismatches.push({
            t,
            label,
            expectedDirection: baseline.direction,
            expectedCanvasSha256: baseline.canvasSha256,
            actualDirection: other.direction,
            actualCanvasSha256: other.canvasSha256,
          });
        }
      }
    }
  }

  const manifest = {
    jump: jump.id,
    slug: jump.slug,
    boundary: jump.boundary,
    from: jump.from,
    to: jump.to,
    ambientTime,
    introTime,
    viewport: page.viewportSize() ?? { width: 1280, height: 800 },
    tValues,
    directions,
    frames,
    parity: {
      allMatch: mismatches.length === 0,
      mismatches,
    },
    generatedAt: new Date().toISOString(),
  };

  if (writePng) {
    await writeFile(join(jumpDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  }
  return manifest;
}

async function startProductionServer() {
  if (!existsSync('.next/BUILD_ID')) {
    await new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'build'], { stdio: 'inherit' });
      child.once('error', rejectPromise);
      child.once('exit', code => (code === 0 ? resolvePromise() : rejectPromise(new Error(`Build failed: ${code}`))));
    });
  }
  process.env.NODE_ENV = 'production';
  const app = next({ dev: false, hostname: '127.0.0.1' });
  await app.prepare();
  const server = createServer(app.getRequestHandler());
  await new Promise((resolvePromise, rejectPromise) => {
    server.once('error', rejectPromise);
    server.listen(0, '127.0.0.1', resolvePromise);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not allocate ephemeral port');
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    async close() {
      server.closeAllConnections();
      await new Promise((resolvePromise, rejectPromise) => server.close(err => (err ? rejectPromise(err) : resolvePromise())));
      await app.close();
    },
  };
}

export async function runCaptureJumpsCli(argv = process.argv.slice(2)) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      jump: { type: 'string', short: 'j' },
      ambient: { type: 'string', default: '6' },
      intro: { type: 'string', default: '8' },
      locale: { type: 'string', default: 'en' },
      out: { type: 'string', default: 'captures' },
      url: { type: 'string' },
      t: { type: 'string' },
      directions: { type: 'string' },
      gpu: { type: 'boolean', default: false },
      headed: { type: 'boolean', default: false },
      'canvas-only': { type: 'boolean', default: false },
    },
  });

  const jumpInput = values.jump ?? positionals[0] ?? 'all';
  const jumps = resolveJumpTargets(jumpInput);
  const ambientTime = Number(values.ambient ?? 6);
  const introTime = Number(values.intro ?? 8);
  if (!Number.isFinite(ambientTime) || ambientTime < 0) throw new Error('--ambient must be a non-negative number');
  if (!Number.isFinite(introTime) || introTime < 0) throw new Error('--intro must be a non-negative number');
  const locale = values.locale === 'ar' ? 'ar' : 'en';
  const tValues = parseTValues(values.t);
  const directions = values.directions
    ? values.directions.split(',').map(d => d.trim()).filter(Boolean)
    : [...CAPTURE_DIRECTIONS];
  const outDir = resolve(values.out ?? 'captures');
  await mkdir(outDir, { recursive: true });

  const useGpu = values.gpu || process.env.PLAYWRIGHT_GPU === '1';
  const launchOptions = useGpu
    ? { channel: systemChromeChannel(), headless: !values.headed, args: gpuArgs }
    : {
        headless: !values.headed,
        args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
      };

  let server = null;
  let browser = null;
  try {
    server = values.url ? null : await startProductionServer();
    const baseUrl = values.url ?? server.baseUrl;
    browser = await chromium.launch(launchOptions);
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(60_000);

    const targetUrl = `${baseUrl.replace(/\/$/, '')}/${locale}?capture=1&ambient=${ambientTime}&intro=${introTime}&experienceDebug=1#s01`;
    await page.goto(targetUrl);
    await waitForSettledFrame(page, ['s01']);

    const summaries = [];
    const dirMap = { forward: 'fwd', reverse: 'rev', 'direct-seek': 'seek' };
    for (const jump of jumps) {
      const manifest = await captureJumpFrames(page, jump, {
        ambientTime,
        introTime,
        tValues,
        directions,
        outDir,
        canvasOnly: Boolean(values['canvas-only']),
      });
      summaries.push({
        jump: manifest.jump,
        slug: manifest.slug,
        frames: manifest.frames.length,
        allMatch: manifest.parity.allMatch,
        manifestPath: posix.join(jump.slug, 'manifest.json'),
      });
      console.log(`Captured ${manifest.jump} (${manifest.frames.length} frames, parity=${manifest.parity.allMatch}) -> ${join(outDir, jump.slug)}`);
    }

    const allSummaries = [];
    const contactFrames = [];
    for (const candidate of JUMPS) {
      const manifestPath = join(outDir, candidate.slug, 'manifest.json');
      if (!existsSync(manifestPath)) continue;
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      allSummaries.push({
        jump: manifest.jump,
        slug: manifest.slug,
        frames: manifest.frames.length,
        allMatch: manifest.parity.allMatch,
        manifestPath: posix.join(candidate.slug, 'manifest.json'),
      });
      for (const frame of manifest.frames) {
        contactFrames.push({
          file: contactFrameRelativePath(candidate.slug, frame.file),
          card: candidate.slug.toUpperCase(),
          kind: 'jump',
          id: `${candidate.from.toUpperCase()}\u2192${candidate.to.toUpperCase()}`,
          direction: dirMap[frame.direction] ?? frame.direction,
          t: frame.t,
        });
      }
    }

    const framesJsonPath = join(outDir, 'frames.json');
    await writeFile(framesJsonPath, JSON.stringify(contactFrames, null, 2) + '\n');
    await writeFile(
      join(outDir, 'index.json'),
      JSON.stringify({ ambientTime, introTime, locale, jumps: allSummaries, generatedAt: new Date().toISOString() }, null, 2) + '\n',
    );

    const contactSheetScript = resolve('scripts/contact-sheet.mjs');
    if (existsSync(contactSheetScript)) {
      await new Promise((resolvePromise, rejectPromise) => {
        const child = spawn(
          process.execPath,
          [contactSheetScript, '--frames', framesJsonPath, '--out', join(outDir, 'sheets')],
          { stdio: 'inherit' },
        );
        child.once('error', rejectPromise);
        child.once('exit', code => (code === 0 ? resolvePromise() : rejectPromise(new Error(`contact-sheet exited with ${code}`))));
      });
    }

    await page.close();
    return summaries;
  } finally {
    await browser?.close();
    await server?.close();
  }
}

const isMain = Boolean(process.argv[1] && /(?:^|[\\/])capture-jumps\.mjs$/i.test(process.argv[1]));
if (isMain) {
  runCaptureJumpsCli().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
