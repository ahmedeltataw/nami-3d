import { chromium } from '@playwright/test';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

export const DEFAULT_JUMP_TIMES = [0, .15, .30, .50, .53, .59, .60, .78, 1];
const templatePath = join(dirname(fileURLToPath(import.meta.url)), 'contact-sheet', 'template.html');

export function parseFrameName(file) {
  const name = basename(file);
  const match = name.match(/^(S\d{2})-(S\d{2})_(fwd|rev|seek)_t(\d+(?:\.\d+)?)\.png$/i);
  const sceneMatch = name.match(/^(S\d{2})_(fwd|rev|seek)_b(\d+(?:\.\d+)?)\.png$/i);
  if (sceneMatch) {
    const [, scene, direction, rawB] = sceneMatch;
    return { file, card: scene.toUpperCase(), kind: 'scene', id: scene.toUpperCase(), b: Number(rawB), direction: direction.toLowerCase() };
  }
  if (!match) throw new Error(`Unrecognized frame filename: ${basename(file)}`);
  const [, from, to, direction, rawT] = match;
  return { file, card: `${from.toUpperCase()}-${to.toUpperCase()}`, kind: 'jump', id: `${from.toUpperCase()}${String.fromCharCode(8594)}${to.toUpperCase()}`, t: Number(rawT), direction: direction.toLowerCase() };
}

export function orderFrames(frames) {
  return [...frames].sort((a, b) => Number(a.t ?? a.b) - Number(b.t ?? b.b) || a.direction.localeCompare(b.direction) || a.file.localeCompare(b.file));
}

export function groupFrames(frames) {
  const groups = new Map();
  for (const frame of frames) {
    const key = `${frame.kind}\0${frame.card}\0${frame.id}`;
    if (!groups.has(key)) groups.set(key, { kind: frame.kind, card: frame.card, id: frame.id, frames: [] });
    groups.get(key).frames.push(frame);
  }
  return [...groups.values()].map(group => ({ ...group, frames: orderFrames(group.frames) }));
}

export async function readFrames({ framesPath, dir }) {
  if (framesPath) {
    const entries = JSON.parse((await readFile(resolve(framesPath), 'utf8')).replace(/^\uFEFF/, ''));
    if (!Array.isArray(entries)) throw new Error('--frames must contain a JSON array');
    return entries.map(frame => ({ ...frame, file: resolve(dirname(resolve(framesPath)), frame.file) }));
  }
  if (!dir) throw new Error('Provide --frames <frames.json> or --dir <folder>');
  const folder = resolve(dir);
  const names = await readdir(folder);
  return names.filter(name => extname(name).toLowerCase() === '.png').map(name => parseFrameName(join(folder, name)));
}

function htmlForSheet(template, group, sections, date) {
  const payload = { heading: `${group.card} ${String.fromCharCode(183)} ${group.id}`, date, sections };
  const script = `const data=${JSON.stringify(payload).replaceAll('<', '\\u003c')};\n` +
    `document.querySelector('#heading').textContent=data.heading;document.querySelector('#date').textContent=data.date;` +
    `const root=document.querySelector('#sections');` +
    `for(const section of data.sections){const block=document.createElement('section');block.className='direction';` +
    `const title=document.createElement('h2');title.textContent=section.label;block.append(title);` +
    `const grid=document.createElement('div');grid.className='grid';grid.style.setProperty('--columns',Math.min(3,section.frames.length));` +
    `for(const frame of section.frames){const figure=document.createElement('figure');const box=document.createElement('div');box.className='frame';` +
    `if(frame.src){const img=document.createElement('img');img.src=frame.src;img.alt=frame.label;box.append(img)}else{const missing=document.createElement('div');missing.className='missing';missing.textContent='FRAME MISSING';box.append(missing)}` +
    `const caption=document.createElement('figcaption');caption.textContent=frame.label;figure.append(box,caption);grid.append(figure)}` +
    `block.append(grid);root.append(block)}`;
  return template.replace('</body>', `<script>${script}</script></body>`);
}

export function sheetFrames(group) {
  if (group.kind !== 'jump') return orderFrames(group.frames).map(frame => ({ ...frame, label: `b ${(Number(frame.b) || 0).toFixed(2).replace(/^0/, '')}` }));
  return ['fwd', 'rev', 'seek'].flatMap(direction => {
    const frames = group.frames.filter(frame => frame.direction === direction);
    const slots = DEFAULT_JUMP_TIMES.map(t => {
      const index = frames.findIndex(frame => Math.abs(Number(frame.t) - t) < .00001);
      return index < 0
        ? { t, direction, missing: true }
        : frames.splice(index, 1)[0];
    });
    return [...slots, ...orderFrames(frames)].map(frame => ({
      ...frame,
      label: `t ${Number(frame.t).toFixed(2).replace(/^0/, '')}`,
    }));
  });
}

export function sheetSections(group) {
  const frames = sheetFrames(group);
  if (group.kind !== 'jump') return [{ direction: null, label: 'frames', frames }];
  return ['fwd', 'rev', 'seek'].map(direction => ({
    direction,
    label: { fwd: 'forward', rev: 'reverse', seek: 'seek' }[direction],
    frames: frames.filter(frame => frame.direction === direction),
  }));
}

export async function renderSheets(groups, outDir, { browserType = chromium, date = new Date().toISOString().slice(0, 10) } = {}) {
  const out = resolve(outDir);
  await mkdir(out, { recursive: true });
  const template = await readFile(templatePath, 'utf8');
  const browser = await browserType.launch({ headless: true });
  const rows = [];
  try {
    for (const group of groups) {
      const sections = await Promise.all(sheetSections(group).map(async section => ({
        ...section,
        frames: await Promise.all(section.frames.map(async frame => ({
          label: frame.label,
          src: frame.missing ? null : `data:image/png;base64,${(await readFile(resolve(frame.file))).toString('base64')}`,
        }))),
      })));
      const safeId = group.id.replace(/[^\w.-]+/g, '-');
      const filename = `sheet-${group.kind}-${safeId}.png`;
      const page = await browser.newPage({ viewport: { width: 2400, height: 1400 }, deviceScaleFactor: 1 });
      await page.setContent(htmlForSheet(template, group, sections, date));
      await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
      await page.screenshot({ path: join(out, filename), fullPage: true });
      await page.close();
      rows.push({ filename, group });
    }
  } finally { await browser.close(); }
  const index = ['# Contact sheets', '', `Generated: ${date}`, ''];
  for (const { filename, group } of rows) {
    index.push(`## ${group.card} ${String.fromCharCode(183)} ${group.id}`, '', `Sheet: [${filename}](./${filename})`, '', 'Frames:');
    for (const frame of group.frames) index.push(`- ${frame.file}`);
    index.push('');
  }
  await writeFile(join(out, 'index.md'), `${index.join('\n')}\n`);
  return rows;
}

async function main() {
  const { values } = parseArgs({ options: { frames: { type: 'string' }, dir: { type: 'string' }, out: { type: 'string', default: 'contact-sheets' } } });
  const frames = await readFrames({ framesPath: values.frames, dir: values.dir });
  const groups = groupFrames(frames);
  if (!groups.length) throw new Error('No PNG frames found');
  const rows = await renderSheets(groups, values.out);
  console.log(`Rendered ${rows.length} sheets to ${resolve(values.out)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(error => { console.error(error); process.exitCode = 1; });
