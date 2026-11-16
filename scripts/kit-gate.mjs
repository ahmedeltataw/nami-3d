// Run from the kit worktree: node path/to/kit-gate.mjs <kit> <S0N> [--budget 120000]
import { readFileSync, statSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { inflateSync } from 'node:zlib'

const args = process.argv.slice(2)
const budgetIndex = args.indexOf('--budget')
const budgetText = budgetIndex < 0 ? '120000' : args[budgetIndex + 1]
if (budgetIndex >= 0) args.splice(budgetIndex, 2)
const [kit, scene] = args
const budget = Number(budgetText)
if (args.length !== 2 || !/^[\w-]+$/.test(kit ?? '') || !/^S\d{2}$/i.test(scene ?? '') || !/^\d+$/.test(budgetText ?? '') || !Number.isSafeInteger(budget)) {
  console.error('Usage: node scripts/kit-gate.mjs <kit> <S0N> [--budget 120000]')
  process.exit(2)
}
const root = process.cwd()
const mainRoot = basename(dirname(root)).toLowerCase() === '.worktrees' ? dirname(dirname(root)) : root
const exportDir = join(root, 'assets-model', 'export')
const renderDir = join(root, 'test-results', 'blender')
const files = {
  glb: join(exportDir, `${kit}.glb`),
  manifest: join(exportDir, `${kit}.manifest.json`),
  blend: join(root, 'assets-model', `${kit}.blend`),
  script: join(root, 'assets-model', 'scripts', `${kit}.py`),
  render: join(renderDir, `${kit}-reference.png`),
  compare: join(renderDir, `${kit}-compare.png`),
  review: join(exportDir, `${kit}.review.md`),
  reference: join(mainRoot, 'briefs', 'refs', `${scene.toUpperCase()}.png`),
}
const failures = []
const present = {}
for (const [label, path] of Object.entries(files)) {
  try {
    const stat = statSync(path)
    if (!stat.isFile()) throw new Error('not a file')
    present[label] = true
    if (label === 'review' && stat.size <= 300) failures.push(`review must exceed 300 bytes (got ${stat.size}): ${path}`)
  } catch { failures.push(`missing ${label}: ${path}`) }
}

// Decode non-interlaced PNGs without a native dependency. Luminance is computed
// from displayed sRGB bytes (Rec. 709 weights), matching the visual QA metric.
function pngInfo(path) {
  const data = readFileSync(path)
  if (!data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('invalid PNG signature')
  let p = 8, width, height, depth, type, interlace, palette, transparency
  const chunks = []
  while (p + 12 <= data.length) {
    const len = data.readUInt32BE(p), name = data.toString('ascii', p + 4, p + 8)
    if (p + 12 + len > data.length) throw new Error('truncated PNG chunk')
    const chunk = data.subarray(p + 8, p + 8 + len)
    if (name === 'IHDR') { width = chunk.readUInt32BE(0); height = chunk.readUInt32BE(4); depth = chunk[8]; type = chunk[9]; interlace = chunk[12] }
    if (name === 'PLTE') palette = chunk
    if (name === 'tRNS') transparency = chunk
    if (name === 'IDAT') chunks.push(chunk)
    p += len + 12
    if (name === 'IEND') break
  }
  const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 })[type]
  if (!width || !height || !channels || interlace !== 0 || ![8, 16].includes(depth) || (type === 3 && (depth !== 8 || !palette))) throw new Error(`unsupported PNG format (type ${type}, depth ${depth}, interlace ${interlace})`)
  const bpp = channels * depth / 8, stride = width * bpp, raw = inflateSync(Buffer.concat(chunks))
  if (raw.length !== (stride + 1) * height) throw new Error('invalid PNG image data length')
  let previous = Buffer.alloc(stride), sum = 0
  const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c }
  for (let y = 0; y < height; y++) {
    const offset = y * (stride + 1), filter = raw[offset], row = Buffer.allocUnsafe(stride)
    if (filter > 4) throw new Error(`invalid PNG filter ${filter}`)
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? row[x - bpp] : 0, b = previous[x], c = x >= bpp ? previous[x - bpp] : 0
      row[x] = (raw[offset + 1 + x] + [0, a, b, Math.floor((a + b) / 2), paeth(a, b, c)][filter]) & 255
    }
    for (let x = 0; x < width; x++) {
      const i = x * bpp, step = depth / 8
      let r, g, b, alpha = 255
      if (type === 3) { const index = row[i]; r = palette[index * 3]; g = palette[index * 3 + 1]; b = palette[index * 3 + 2]; alpha = transparency?.[index] ?? 255; if (r === undefined) throw new Error('invalid palette index') }
      else if (type === 0 || type === 4) { r = g = b = row[i]; if (type === 4) alpha = row[i + step] }
      else { r = row[i]; g = row[i + step]; b = row[i + 2 * step]; if (type === 6) alpha = row[i + 3 * step] }
      // Transparent pixels are composited over black, as in the review images.
      sum += (0.2126 * r + 0.7152 * g + 0.0722 * b) * alpha / 255
    }
    previous = row
  }
  return { width, height, mean: sum / (width * height) }
}
let render, reference
for (const label of ['render', 'reference']) if (present[label]) {
  try { if (label === 'render') render = pngInfo(files[label]); else reference = pngInfo(files[label]) }
  catch (error) { failures.push(`cannot decode ${label}: ${error.message}`) }
}
if (render && (render.width !== 1672 || render.height !== 941)) failures.push(`render resolution ${render.width}x${render.height}; expected 1672x941`)
if (render && reference) {
  const ratio = reference.mean ? render.mean / reference.mean : NaN
  console.log(`Luminance: render ${render.mean.toFixed(2)}, reference ${reference.mean.toFixed(2)}, ratio ${(ratio * 100).toFixed(1)}%`)
  if (!Number.isFinite(ratio) || ratio < 0.8 || ratio > 1.25) failures.push('luminance ratio must be 80–125%')
}
if (present.manifest) {
  try {
    const manifest = JSON.parse(readFileSync(files.manifest, 'utf8'))
    const tris = manifest.tris_total
    if (!Number.isSafeInteger(tris) || tris < 0) failures.push('manifest tris_total must be a non-negative integer')
    else { console.log(`Triangles: ${tris} / ${budget}`); if (tris > budget) failures.push(`triangle budget exceeded: ${tris} > ${budget}`) }
  } catch (error) { failures.push(`cannot read manifest: ${error.message}`) }
}
if (failures.length) { console.error(`FAIL ${kit} (${failures.length}):\n${failures.map((failure) => `- ${failure}`).join('\n')}`); process.exitCode = 1 }
else console.log(`PASS ${kit}`)
