/**
 * Validates and prints S03 demo prop reuse bindings against s03_lab_v2.glb,
 * s03_lab_v2.manifest.json, station_*.glb, and the MO-PLAN.md §8 triangle budget.
 *
 * Usage: node assets-model/scripts/s03_demo_bindings.mjs
 */
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const ROOT = process.cwd();
const EXPORT_DIR = join(ROOT, 'assets-model', 'export');
const BINDINGS_PATH = join(EXPORT_DIR, 's03_demo_bindings.json');
const LAB_GLB_PATH = join(EXPORT_DIR, 's03_lab_v2.glb');
const LAB_MANIFEST_PATH = join(EXPORT_DIR, 's03_lab_v2.manifest.json');

const EPS_BOX = 1e-4;
const MIN_FOOTPRINT_MARGIN_M = 0.05;
const MIN_OVERLAP_SEP_M = 1e-3;
const MAX_CENTER_OFFSET_X_M = 0.05;

// MO-PLAN.md §8 S03 budget constants
const PLAN_S03_BUDGET_TRIS = 100000;
const PLAN_S03_DESKTOP_FALLBACK_TRIS = 120000;
const PLAN_ROBOT_LOW_LOD_TRIS = 14876;

// All 11 demo roles from MO-2c report that have no direct v2 node in s03_lab_v2.glb
const EXPECTED_MO2C_ROLES = [
  { role: 'window cards ×N slide in L → R', station: 'code', pedestal: 'S03_pedestal_code' },
  { role: 'two floating phones slide in and swap/yaw', station: 'phone', pedestal: 'S03_pedestal_phone' },
  { role: 'megaphone pulses', station: 'chart', pedestal: 'S03_pedestal_chart' },
  { role: '3 social icons orbit', station: 'chart', pedestal: 'S03_pedestal_chart' },
  { role: '4 flow nodes pop in (.03 apart)', station: 'headphones', pedestal: 'S03_pedestal_headphones' },
  { role: '3 arrows grow', station: 'headphones', pedestal: 'S03_pedestal_headphones' },
  { role: '2 racks rise', station: 'cloud', pedestal: 'S03_pedestal_cloud' },
  { role: 'link rings spin (stop at s .80)', station: 'cloud', pedestal: 'S03_pedestal_cloud' },
  { role: '2 wireframes converge', station: 'layers', pedestal: 'S03_pedestal_layers' },
  { role: 'stylus scribble (circular, amplitude shrinks to 0)', station: 'layers', pedestal: 'S03_pedestal_layers' },
  { role: '4 swatches converge', station: 'layers', pedestal: 'S03_pedestal_layers' },
];

function readGlb(filePath) {
  const buf = readFileSync(filePath);
  if (buf.length < 12 || buf.readUInt32LE(0) !== 0x46546c67 || buf.readUInt32LE(4) !== 2) {
    throw new Error(`Invalid glTF 2.0 binary header: ${filePath}`);
  }
  const length = buf.readUInt32LE(8);
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < length) {
    const chunkLen = buf.readUInt32LE(offset);
    const chunkType = buf.readUInt32LE(offset + 4);
    const chunkData = buf.subarray(offset + 8, offset + 8 + chunkLen);
    if (chunkType === 0x4e4f534a) json = JSON.parse(chunkData.toString('utf8'));
    else if (chunkType === 0x004e4942) bin = chunkData;
    offset += 8 + chunkLen;
  }
  if (!json || !bin) throw new Error(`Missing JSON or BIN chunk in GLB: ${filePath}`);
  return { json, bin };
}

function readPositions(json, bin, accessorIdx) {
  const acc = json.accessors[accessorIdx];
  if (!acc || acc.componentType !== 5126 || acc.type !== 'VEC3') {
    throw new Error(`Unsupported POSITION accessor format at index ${accessorIdx}`);
  }
  const bv = json.bufferViews[acc.bufferView];
  const byteOffset = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  const stride = bv.byteStride || 12;
  const pts = new Array(acc.count);
  for (let i = 0; i < acc.count; i++) {
    const o = byteOffset + i * stride;
    pts[i] = [bin.readFloatLE(o), bin.readFloatLE(o + 4), bin.readFloatLE(o + 8)];
  }
  return pts;
}

function mat4Identity() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function mat4Mul(a, b) {
  const out = new Array(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      out[col * 4 + row] =
        a[0 * 4 + row] * b[col * 4 + 0] +
        a[1 * 4 + row] * b[col * 4 + 1] +
        a[2 * 4 + row] * b[col * 4 + 2] +
        a[3 * 4 + row] * b[col * 4 + 3];
    }
  }
  return out;
}

function mat4FromTRS(t = [0, 0, 0], q = [0, 0, 0, 1], s = [1, 1, 1]) {
  const [x, y, z, w] = q;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  return [
    (1 - (yy + zz)) * s[0], (xy + wz) * s[0], (xz - wy) * s[0], 0,
    (xy - wz) * s[1], (1 - (xx + zz)) * s[1], (yz + wx) * s[1], 0,
    (xz + wy) * s[2], (yz - wx) * s[2], (1 - (xx + yy)) * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}

/** Three.js intrinsic XYZ Euler rotation + translation + scale. */
function mat4FromEulerXYZ(t, euler, s) {
  const [rx, ry, rz] = euler;
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);
  const ae = cy * cz, af = -cy * sz, ag = sy;
  const be = sx * sy * cz + cx * sz, bf = -sx * sy * sz + cx * cz, bg = -sx * cy;
  const ce = -cx * sy * cz + sx * sz, cf = cx * sy * sz + sx * cz, cg = cx * cy;
  return [
    ae * s[0], be * s[0], ce * s[0], 0,
    af * s[1], bf * s[1], cf * s[1], 0,
    ag * s[2], bg * s[2], cg * s[2], 0,
    t[0], t[1], t[2], 1,
  ];
}

function transformPoint(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

function rotY(x, z, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [x * c + z * s, -x * s + z * c];
}

function countGlbTris(glb) {
  let tris = 0;
  for (const node of glb.json.nodes || []) {
    if (node.mesh === undefined) continue;
    for (const prim of glb.json.meshes[node.mesh].primitives) {
      if ((prim.mode ?? 4) !== 4) continue;
      const count = prim.indices !== undefined
        ? glb.json.accessors[prim.indices].count
        : glb.json.accessors[prim.attributes.POSITION].count;
      tris += count / 3;
    }
  }
  return tris;
}

function getSubtreeData(glb, nodeName) {
  const { json, bin } = glb;
  const rootIdx = (json.nodes || []).findIndex((n) => n.name === nodeName);
  if (rootIdx < 0) return null;
  const points = [];
  let tris = 0;
  function visit(idx, relMat) {
    const node = json.nodes[idx];
    const m = idx === rootIdx
      ? mat4Identity()
      : mat4Mul(relMat, node.matrix || mat4FromTRS(node.translation, node.rotation, node.scale));
    if (node.mesh !== undefined) {
      for (const prim of json.meshes[node.mesh].primitives) {
        if ((prim.mode ?? 4) === 4) {
          const count = prim.indices !== undefined
            ? json.accessors[prim.indices].count
            : json.accessors[prim.attributes.POSITION].count;
          tris += count / 3;
        }
        for (const p of readPositions(json, bin, prim.attributes.POSITION)) {
          points.push(transformPoint(m, p));
        }
      }
    }
    for (const childIdx of node.children || []) visit(childIdx, m);
  }
  visit(rootIdx, mat4Identity());
  return { points, tris };
}

function computeBounds(points) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const p of points) {
    for (let k = 0; k < 3; k++) {
      if (p[k] < min[k]) min[k] = p[k];
      if (p[k] > max[k]) max[k] = p[k];
    }
  }
  return { min, max };
}

function inspectLabPedestals(labGlb, labManifest) {
  const nodes = labGlb.json.nodes || [];
  const manifestCards = new Map((labManifest.cards || []).map((c) => [c.pedestal, c]));
  const info = new Map();

  for (const [pedName, card] of manifestCards) {
    const pedNode = nodes.find((n) => n.name === pedName);
    const panelNode = nodes.find((n) => n.name === card.node);
    if (!pedNode || !panelNode) continue;

    const pedScale = pedNode.scale || [1, 1, 1];
    const pedTrans = pedNode.translation || [0, 0, 0];
    let topY = -Infinity;
    let topDiscR = 0;
    for (const prim of labGlb.json.meshes[pedNode.mesh].primitives) {
      const matName = labGlb.json.materials[prim.material]?.name;
      for (const [x, y, z] of readPositions(labGlb.json, labGlb.bin, prim.attributes.POSITION)) {
        const wy = y * pedScale[1];
        const r = Math.hypot(x * pedScale[0], z * pedScale[2]);
        if (wy > topY) topY = wy;
        if (wy > 0.45 && matName === 'M_Metal_Dark' && r > topDiscR) topDiscR = r;
      }
    }

    const q = panelNode.rotation || [0, 0, 0, 1];
    const yaw = 2 * Math.atan2(q[1], q[3]);
    const px0 = panelNode.translation[0];
    const pz0 = panelNode.translation[2];
    let maxFrontPanelZ = -Infinity;
    for (const n of nodes) {
      if (!n.name || n.mesh === undefined) continue;
      const isCardPart = n.name === card.node ||
        n.name.startsWith(card.icon_prefix) ||
        n.name.startsWith(card.button_prefix);
      if (!isCardPart) continue;
      const m = n.matrix || mat4FromTRS(n.translation, n.rotation, n.scale);
      for (const prim of labGlb.json.meshes[n.mesh].primitives) {
        for (const p of readPositions(labGlb.json, labGlb.bin, prim.attributes.POSITION)) {
          const wp = transformPoint(m, p);
          const [, pz] = rotY(wp[0] - px0, wp[2] - pz0, -yaw);
          if (pz > maxFrontPanelZ) maxFrontPanelZ = pz;
        }
      }
    }

    info.set(pedName, {
      id: card.id,
      panelName: card.node,
      pedTranslationGlb: pedTrans,
      pedScaleGlb: pedScale,
      worldOriginGlb: [pedTrans[0], pedTrans[1] + topY, pedTrans[2]],
      yawRad: yaw,
      topDiscR,
      maxFrontPanelZ,
    });
  }
  return info;
}

function isVec3(v) {
  return Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n));
}

function boxesOverlap(a, b, minSep) {
  return (
    a.min[0] < b.max[0] - minSep && a.max[0] > b.min[0] + minSep &&
    a.min[1] < b.max[1] - minSep && a.max[1] > b.min[1] + minSep &&
    a.min[2] < b.max[2] - minSep && a.max[2] > b.min[2] + minSep
  );
}

/** Validate that every MO-2c role appears once in roles[] and every binding belongs to one role. */
function validateRoles(data, failures) {
  const bindings = Array.isArray(data.bindings) ? data.bindings : [];
  if (!Array.isArray(data.roles)) {
    failures.push('roles must be an array summarizing each MO-2c role');
    return;
  }

  const expectedByRole = new Map(EXPECTED_MO2C_ROLES.map((r) => [r.role, r]));
  const roleSeenCount = new Map(EXPECTED_MO2C_ROLES.map((r) => [r.role, 0]));
  const bindingClaims = Array.from({ length: bindings.length }, () => []);

  for (let i = 0; i < data.roles.length; i++) {
    const entry = data.roles[i];
    const tag = `roles[${i}] (${entry?.role ?? 'unknown'})`;
    const expected = expectedByRole.get(entry?.role);
    if (!expected) {
      failures.push(`${tag}: unexpected role not in MO-2c report`);
      continue;
    }
    roleSeenCount.set(entry.role, roleSeenCount.get(entry.role) + 1);

    if (entry.station !== expected.station) {
      failures.push(`${tag}: station mismatch (json=${entry.station}, expected=${expected.station})`);
    }
    if (entry.pedestal !== expected.pedestal) {
      failures.push(`${tag}: pedestal mismatch (json=${entry.pedestal}, expected=${expected.pedestal})`);
    }
    if (!Array.isArray(entry.bindingIndices) || entry.bindingIndices.length === 0) {
      failures.push(`${tag}: bindingIndices must be a non-empty array`);
      continue;
    }

    const seenInRole = new Set();
    let roleTris = 0;
    const roleNodes = [];
    for (const idx of entry.bindingIndices) {
      if (!Number.isInteger(idx) || idx < 0 || idx >= bindings.length) {
        failures.push(`${tag}: invalid binding index ${idx}`);
        continue;
      }
      if (seenInRole.has(idx)) {
        failures.push(`${tag}: duplicate binding index ${idx}`);
        continue;
      }
      seenInRole.add(idx);
      bindingClaims[idx].push(entry.role);

      const b = bindings[idx];
      if (b.role !== entry.role) {
        failures.push(`${tag}: bindings[${idx}].role "${b.role}" does not match "${entry.role}"`);
      }
      if (b.station !== entry.station || b.pedestal !== entry.pedestal) {
        failures.push(`${tag}: bindings[${idx}] station/pedestal mismatch`);
      }
      roleTris += b.tris;
      roleNodes.push(b.sourceNode);
    }

    if (entry.sourceNodes !== undefined) {
      const sameNodes = Array.isArray(entry.sourceNodes) &&
        entry.sourceNodes.length === roleNodes.length &&
        entry.sourceNodes.every((n, k) => n === roleNodes[k]);
      if (!sameNodes) {
        failures.push(`${tag}: sourceNodes mismatch vs bindingIndices`);
      }
    }
    if (entry.tris !== undefined && entry.tris !== roleTris) {
      failures.push(`${tag}: tris mismatch (json=${entry.tris}, computed=${roleTris})`);
    }
  }

  for (const [role, count] of roleSeenCount) {
    if (count !== 1) {
      failures.push(`MO-2c role "${role}" appears ${count} times in roles[] (expected 1)`);
    }
  }
  for (let i = 0; i < bindings.length; i++) {
    const claims = bindingClaims[i];
    if (claims.length !== 1) {
      failures.push(`bindings[${i}] (${bindings[i]?.sourceNode}) belongs to ${claims.length} roles (expected 1)`);
    }
  }
}

function main() {
  const failures = [];
  const data = JSON.parse(readFileSync(BINDINGS_PATH, 'utf8'));
  const labGlb = readGlb(LAB_GLB_PATH);
  const labManifest = JSON.parse(readFileSync(LAB_MANIFEST_PATH, 'utf8'));
  const pedestals = inspectLabPedestals(labGlb, labManifest);
  const s03LabTris = countGlbTris(labGlb);

  if (!Array.isArray(data.bindings) || data.bindings.length === 0) {
    failures.push('bindings must be a non-empty array');
  }
  validateRoles(data, failures);

  const expectedPedestals = [
    'S03_pedestal_chart',
    'S03_pedestal_cloud',
    'S03_pedestal_code',
    'S03_pedestal_headphones',
    'S03_pedestal_layers',
    'S03_pedestal_phone',
  ];
  for (const ped of expectedPedestals) {
    if (!pedestals.has(ped)) failures.push(`missing pedestal in s03_lab_v2.glb/manifest: ${ped}`);
  }

  const glbCache = new Map();
  const byPedestal = new Map(expectedPedestals.map((p) => [p, []]));
  let totalAddedTris = 0;

  for (let i = 0; i < (data.bindings || []).length; i++) {
    const b = data.bindings[i];
    const tag = `bindings[${i}] (${b?.sourceNode ?? 'unknown'})`;

    if (typeof b.role !== 'string' || !b.role.trim()) failures.push(`${tag}: missing role`);
    if (!pedestals.has(b.pedestal)) {
      failures.push(`${tag}: unknown pedestal "${b.pedestal}"`);
      continue;
    }
    if (typeof b.sourceGlb !== 'string' || !b.sourceGlb.trim()) {
      failures.push(`${tag}: missing sourceGlb`);
      continue;
    }
    if (typeof b.sourceNode !== 'string' || !b.sourceNode.trim()) {
      failures.push(`${tag}: missing sourceNode`);
      continue;
    }
    if (!b.localTransform || !isVec3(b.localTransform.position) || !isVec3(b.localTransform.rotationEuler) || !isVec3(b.localTransform.scale)) {
      failures.push(`${tag}: invalid localTransform`);
      continue;
    }
    if (!b.fitBox || !isVec3(b.fitBox.min) || !isVec3(b.fitBox.max)) {
      failures.push(`${tag}: invalid fitBox`);
      continue;
    }
    if (!Number.isInteger(b.tris) || b.tris <= 0) {
      failures.push(`${tag}: invalid tris (${b.tris})`);
    }

    const glbFile = basename(b.sourceGlb);
    if (!glbCache.has(glbFile)) {
      try {
        glbCache.set(glbFile, readGlb(join(EXPORT_DIR, glbFile)));
      } catch (err) {
        failures.push(`${tag}: cannot load ${glbFile}: ${err.message}`);
        continue;
      }
    }
    const srcGlb = glbCache.get(glbFile);
    const sub = getSubtreeData(srcGlb, b.sourceNode);
    if (!sub) {
      failures.push(`${tag}: sourceNode "${b.sourceNode}" not found in ${glbFile}`);
      continue;
    }
    if (sub.tris !== b.tris) {
      failures.push(`${tag}: tris mismatch (json=${b.tris}, glb=${sub.tris})`);
    }
    totalAddedTris += sub.tris;

    const mat = mat4FromEulerXYZ(b.localTransform.position, b.localTransform.rotationEuler, b.localTransform.scale);
    const tPts = sub.points.map((p) => transformPoint(mat, p));
    const computedBox = computeBounds(tPts);

    for (let k = 0; k < 3; k++) {
      if (Math.abs(computedBox.min[k] - b.fitBox.min[k]) > EPS_BOX || Math.abs(computedBox.max[k] - b.fitBox.max[k]) > EPS_BOX) {
        failures.push(`${tag}: fitBox axis ${k} mismatch vs GLB transformed vertices`);
        break;
      }
    }

    const pedInfo = pedestals.get(b.pedestal);
    if (computedBox.min[1] < -EPS_BOX) {
      failures.push(`${tag}: sinks below pedestal top (min.y=${computedBox.min[1].toFixed(4)})`);
    }

    // Check XZ footprint against pedestal top disc radius (using both vertices and fitBox corners)
    let maxVertR = 0;
    let minPanelZ = Infinity;
    for (const p of tPts) {
      const r = Math.hypot(p[0], p[2]);
      if (r > maxVertR) maxVertR = r;
      const [, pz] = rotY(p[0], p[2], -pedInfo.yawRad);
      if (pz < minPanelZ) minPanelZ = pz;
    }
    const cornersXZ = [
      [computedBox.min[0], computedBox.min[2]],
      [computedBox.min[0], computedBox.max[2]],
      [computedBox.max[0], computedBox.min[2]],
      [computedBox.max[0], computedBox.max[2]],
    ];
    const maxCornerR = Math.max(...cornersXZ.map(([x, z]) => Math.hypot(x, z)));
    if (maxVertR > pedInfo.topDiscR - MIN_FOOTPRINT_MARGIN_M) {
      failures.push(`${tag}: exceeds pedestal top disc margin (r=${maxVertR.toFixed(4)} > ${(pedInfo.topDiscR - MIN_FOOTPRINT_MARGIN_M).toFixed(4)})`);
    }
    if (minPanelZ <= pedInfo.maxFrontPanelZ) {
      failures.push(`${tag}: intersects glass panel/icons (minPanelZ=${minPanelZ.toFixed(4)} <= ${pedInfo.maxFrontPanelZ.toFixed(4)})`);
    }

    byPedestal.get(b.pedestal).push({
      ...b,
      computedBox,
      maxVertR,
      maxCornerR,
      minPanelZ,
      tPts,
    });
  }

  console.log('=== S03 Demo Bindings Validation ===');
  console.log(`GLB vs Manifest note: manifest lists panel [x, 0.45, z] & yaw_deg; GLB pedestals sit at [x, 0, z], scale [1, 1.4, 1], identity rotation, topY=0.4998m.`);
  console.log('');

  for (const pedName of expectedPedestals) {
    const items = byPedestal.get(pedName) || [];
    const pedInfo = pedestals.get(pedName);
    if (items.length === 0) {
      failures.push(`${pedName}: no bindings assigned`);
      continue;
    }
    const minY = Math.min(...items.map((x) => x.computedBox.min[1]));
    if (minY > EPS_BOX) {
      failures.push(`${pedName}: no prop sits flush on pedestal top surface (minY=${minY.toFixed(4)})`);
    }

    // Check panel-space X centering of combined group
    let panelMinX = Infinity, panelMaxX = -Infinity;
    for (const item of items) {
      for (const p of item.tPts) {
        const [px] = rotY(p[0], p[2], -pedInfo.yawRad);
        if (px < panelMinX) panelMinX = px;
        if (px > panelMaxX) panelMaxX = px;
      }
    }
    const panelCenterX = (panelMinX + panelMaxX) / 2;
    if (Math.abs(panelCenterX) > MAX_CENTER_OFFSET_X_M) {
      failures.push(`${pedName}: group not centered in X (panelCenterX=${panelCenterX.toFixed(4)}m)`);
    }

    // Check pairwise non-overlap
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        if (boxesOverlap(items[i].computedBox, items[j].computedBox, MIN_OVERLAP_SEP_M)) {
          failures.push(`${pedName}: AABB overlap between ${items[i].sourceNode} and ${items[j].sourceNode}`);
        }
      }
    }

    const pedTris = items.reduce((s, x) => s + x.tris, 0);
    const maxR = Math.max(...items.map((x) => x.maxVertR));
    const maxCornerR = Math.max(...items.map((x) => x.maxCornerR));
    const minPanelZ = Math.min(...items.map((x) => x.minPanelZ));
    const margin = pedInfo.topDiscR - maxR;
    console.log(
      `${pedName.padEnd(24)} | props=${String(items.length).padStart(2)} | tris=${String(pedTris).padStart(4)} | ` +
      `maxR=${maxR.toFixed(3)}m (box=${maxCornerR.toFixed(3)}m) / disc=${pedInfo.topDiscR.toFixed(3)}m | ` +
      `margin=${margin.toFixed(3)}m | panelClear=${(minPanelZ - pedInfo.maxFrontPanelZ).toFixed(3)}m | xCenter=${panelCenterX.toFixed(4)}m`
    );
  }

  const peakStationTris = Math.max(...[...byPedestal.values()].map((list) => list.reduce((s, x) => s + x.tris, 0)));
  const combinedAll = s03LabTris + PLAN_ROBOT_LOW_LOD_TRIS + totalAddedTris;
  const combinedPeak = s03LabTris + PLAN_ROBOT_LOW_LOD_TRIS + peakStationTris;

  const baselineCut = s03LabTris + PLAN_ROBOT_LOW_LOD_TRIS - PLAN_S03_BUDGET_TRIS;
  const requiredCutWithProps = combinedAll - PLAN_S03_BUDGET_TRIS;
  const targetSceneTris = PLAN_S03_BUDGET_TRIS - PLAN_ROBOT_LOW_LOD_TRIS - totalAddedTris;

  console.log('');
  console.log('=== S03 Triangle Budget (MO-PLAN.md §8) ===');
  console.log(`s03_lab_v2.glb base tris       : ${s03LabTris.toLocaleString('en-US')}`);
  console.log(`Robot low LOD in S03           : ${PLAN_ROBOT_LOW_LOD_TRIS.toLocaleString('en-US')}`);
  console.log(`Added demo props (all 6)       : ${totalAddedTris.toLocaleString('en-US')} (${EXPECTED_MO2C_ROLES.length} roles -> ${(data.bindings || []).length} prop bindings)`);
  console.log(`Added demo props (peak station): ${peakStationTris.toLocaleString('en-US')} (S03_pedestal_cloud)`);
  console.log(`Combined (all 6 props loaded)  : ${combinedAll.toLocaleString('en-US')} vs ${PLAN_S03_BUDGET_TRIS.toLocaleString('en-US')} target (+${requiredCutWithProps.toLocaleString('en-US')}) | desktop fallback ${PLAN_S03_DESKTOP_FALLBACK_TRIS.toLocaleString('en-US')} (${PLAN_S03_DESKTOP_FALLBACK_TRIS - combinedAll} remaining)`);
  console.log(`Combined (peak single station) : ${combinedPeak.toLocaleString('en-US')} vs ${PLAN_S03_BUDGET_TRIS.toLocaleString('en-US')} target`);
  console.log(`MO-2a cut dependency           : plan §8 asks MO-2a for >= ${baselineCut.toLocaleString('en-US')} tris (${s03LabTris.toLocaleString('en-US')} + ${PLAN_ROBOT_LOW_LOD_TRIS.toLocaleString('en-US')} = ${(s03LabTris + PLAN_ROBOT_LOW_LOD_TRIS).toLocaleString('en-US')} -> ${PLAN_S03_BUDGET_TRIS.toLocaleString('en-US')}); with ${totalAddedTris.toLocaleString('en-US')} added tris MO-2a must cut >= ${requiredCutWithProps.toLocaleString('en-US')} tris (target scene <= ${targetSceneTris.toLocaleString('en-US')}).`);

  if (data.summary?.totalRoles !== EXPECTED_MO2C_ROLES.length) {
    failures.push(`summary.totalRoles mismatch (json=${data.summary?.totalRoles}, expected=${EXPECTED_MO2C_ROLES.length})`);
  }
  if (data.summary?.totalBindings !== (data.bindings || []).length) {
    failures.push(`summary.totalBindings mismatch (json=${data.summary?.totalBindings}, actual=${(data.bindings || []).length})`);
  }
  if (data.summary?.totalAddedTris !== totalAddedTris) {
    failures.push(`summary.totalAddedTris mismatch (json=${data.summary?.totalAddedTris}, computed=${totalAddedTris})`);
  }

  console.log('');
  if (failures.length > 0) {
    console.error(`FAIL (${failures.length}):`);
    for (const f of failures) console.error(`- ${f}`);
    process.exitCode = 1;
  } else {
    console.log(`PASS (${(data.bindings || []).length} prop bindings across ${EXPECTED_MO2C_ROLES.length} roles and ${expectedPedestals.length} pedestals, ${totalAddedTris} added tris)`);
  }
}

main();
