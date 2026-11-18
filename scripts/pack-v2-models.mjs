import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const V2_KITS = [
  ['assets-model/export/s01_hero_v2.glb', 'public/models/s01/s01_hero_v2.glb'],
  ['assets-model/export/s02_portal_v2.glb', 'public/models/s02/s02_portal_v2.glb'],
  ['assets-model/export/s03_lab_v2.glb', 'public/models/s03/s03_lab_v2.glb'],
  ['assets-model/export/s04_idea_v2.glb', 'public/models/s04/s04_idea_v2.glb'],
  ['assets-model/export/s05_multiverse_v2.glb', 'public/models/s05/s05_multiverse_v2.glb'],
  ['assets-model/export/s06_dna_v2.glb', 'public/models/s06/s06_dna_v2.glb'],
  ['assets-model/export/s07_future_v2.glb', 'public/models/s07/s07_future_v2.glb'],
];

function pad4(length) {
  return (4 - (length % 4)) % 4;
}

function packGlbWebp(sourcePath, targetPath, workDir) {
  const source = readFileSync(sourcePath);
  if (source.readUInt32LE(0) !== 0x46546c67) throw new Error(`Invalid GLB header: ${sourcePath}`);
  const jsonLength = source.readUInt32LE(12);
  const json = JSON.parse(source.subarray(20, 20 + jsonLength).toString('utf8'));
  const binHeaderOffset = 20 + jsonLength;
  const binLength = source.readUInt32LE(binHeaderOffset);
  const bin = source.subarray(binHeaderOffset + 8, binHeaderOffset + 8 + binLength);

  const imageBufferViews = new Map();
  const images = json.images ?? [];
  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    if (img.bufferView === undefined) continue;
    if (img.mimeType === 'image/webp') continue;
    const bv = json.bufferViews[img.bufferView];
    const start = bv.byteOffset ?? 0;
    const pngBytes = bin.subarray(start, start + bv.byteLength);
    const pngFile = join(workDir, `img_${i}.png`);
    const webpFile = join(workDir, `img_${i}.webp`);
    writeFileSync(pngFile, pngBytes);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', pngFile, '-c:v', 'libwebp', '-quality', '90', webpFile]);
    const webpBytes = readFileSync(webpFile);
    imageBufferViews.set(img.bufferView, webpBytes);
    img.mimeType = 'image/webp';
  }

  for (const accessor of json.accessors ?? []) {
    if (accessor.bufferView !== undefined && imageBufferViews.has(accessor.bufferView)) {
      throw new Error(`Accessor shares bufferView ${accessor.bufferView} with image in ${sourcePath}`);
    }
  }

  const parts = [];
  let cursor = 0;
  for (let i = 0; i < (json.bufferViews ?? []).length; i++) {
    const bv = json.bufferViews[i];
    const payload = imageBufferViews.get(i) ?? bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength);
    const pad = pad4(payload.length);
    bv.byteOffset = cursor;
    bv.byteLength = payload.length;
    parts.push(payload);
    if (pad > 0) parts.push(Buffer.alloc(pad, 0));
    cursor += payload.length + pad;
  }
  const newBin = Buffer.concat(parts);
  if (json.buffers?.[0]) json.buffers[0].byteLength = newBin.length;

  let usedWebp = false;
  for (const tex of json.textures ?? []) {
    if (tex.source !== undefined && images[tex.source]?.mimeType === 'image/webp') {
      tex.extensions = { ...(tex.extensions ?? {}), EXT_texture_webp: { source: tex.source } };
      delete tex.source;
      usedWebp = true;
    }
  }
  if (usedWebp) {
    json.extensionsUsed = Array.from(new Set([...(json.extensionsUsed ?? []), 'EXT_texture_webp']));
  }

  const jsonRaw = Buffer.from(JSON.stringify(json), 'utf8');
  const jsonPad = pad4(jsonRaw.length);
  const jsonChunk = Buffer.concat([jsonRaw, Buffer.alloc(jsonPad, 0x20)]);
  const totalLength = 12 + 8 + jsonChunk.length + 8 + newBin.length;

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4e4f534a, 4);

  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(newBin.length, 0);
  binChunkHeader.writeUInt32LE(0x004e4942, 4);

  mkdirSync(dirname(targetPath), { recursive: true });
  writeFileSync(targetPath, Buffer.concat([header, jsonChunkHeader, jsonChunk, binChunkHeader, newBin]));
  return { before: source.length, after: totalLength, images: images.length };
}

const workDir = mkdtempSync(join(tmpdir(), 'nami-webp-'));
try {
  for (const [src, dst] of V2_KITS) {
    const result = packGlbWebp(src, dst, workDir);
    const pct = ((1 - result.after / result.before) * 100).toFixed(1);
    console.log(`${dst}: ${(result.before / 1e6).toFixed(2)} MB -> ${(result.after / 1e6).toFixed(2)} MB (-${pct}%, ${result.images} WebP textures)`);
  }
} finally {
  rmSync(workDir, { recursive: true, force: true });
}
