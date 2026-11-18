import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  Euler,
  Group,
  IcosahedronGeometry,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  MirroredRepeatWrapping,
  OctahedronGeometry,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  SphereGeometry,
  Texture,
  TorusGeometry,
  Vector3,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { applyMatteCardMaterial } from '../../src/experience/assets/matte';
import { SCENE_IDS } from '../../src/experience/controller';
import type { SampleInput, SceneId } from '../../src/experience/contracts';
import { RobotComposer } from '../../src/experience/robot/compose';
import { robotPlacement } from '../../src/experience/robot/placement';
import { scenes } from '../../src/experience/scenes';
import {
  applyFingerRestYaw,
  blenderEulerDegToGltfQuaternion,
  blenderQuatWxyzToGltfXyzw,
  blenderRawXyzwToGltfXyzw,
  blenderToGltfPosition,
  getSceneHero,
  s03BindingsData,
  s04PhoneData,
  s05MultiverseData,
  s06DnaData,
  s07FutureData,
  SCENE_HEROES,
} from '../../src/experience/scenes/manifests';

import robotClipData from '../../assets-model/export/robot_clip_data.json';
import s01Manifest from '../../assets-model/export/s01_hero_v2.manifest.json';
import s02Manifest from '../../assets-model/export/s02_portal_v2.manifest.json';
import s03Manifest from '../../assets-model/export/s03_lab_v2.manifest.json';
import s03Bindings from '../../assets-model/export/s03_demo_bindings.json';
import s04Manifest from '../../assets-model/export/s04_idea_v2.manifest.json';
import s05Manifest from '../../assets-model/export/s05_multiverse_v2.manifest.json';
import s06Manifest from '../../assets-model/export/s06_dna_v2.manifest.json';
import s07Manifest from '../../assets-model/export/s07_future_v2.manifest.json';

type GlbJson = {
  nodes?: Array<{
    name?: string;
    mesh?: number;
    children?: number[];
    translation?: number[];
    rotation?: number[];
    scale?: number[];
    extras?: Record<string, unknown>;
  }>;
  meshes?: Array<{
    name?: string;
    primitives?: Array<{ indices?: number; attributes: Record<string, number> }>;
  }>;
  accessors?: Array<{ count: number }>;
  images?: Array<{ mimeType?: string; name?: string }>;
  samplers?: Array<{ wrapS?: number; wrapT?: number }>;
  extensionsUsed?: string[];
};

function readGlbJson(relPath: string): GlbJson {
  const buf = readFileSync(resolve(process.cwd(), relPath));
  const jsonLength = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + jsonLength).toString('utf8')) as GlbJson;
}

function countGlbTriangles(json: GlbJson): number {
  let tris = 0;
  for (const mesh of json.meshes ?? []) {
    for (const prim of mesh.primitives ?? []) {
      const count = prim.indices !== undefined
        ? json.accessors![prim.indices].count
        : json.accessors![prim.attributes.POSITION].count;
      tris += count / 3;
    }
  }
  return tris;
}

function countNodeTriangles(json: GlbJson, nodeName: string): number {
  const nodeMap = new Map<string, NonNullable<GlbJson['nodes']>[number]>();
  for (const n of json.nodes ?? []) if (n.name) nodeMap.set(n.name, n);
  const root = nodeMap.get(nodeName);
  if (!root) throw new Error(`Missing node ${nodeName}`);
  let tris = 0;
  const visit = (node: NonNullable<GlbJson['nodes']>[number]) => {
    if (node.mesh !== undefined) {
      for (const prim of json.meshes![node.mesh].primitives ?? []) {
        const count = prim.indices !== undefined
          ? json.accessors![prim.indices].count
          : json.accessors![prim.attributes.POSITION].count;
        tris += count / 3;
      }
    }
    for (const childIdx of node.children ?? []) {
      visit(json.nodes![childIdx]);
    }
  };
  visit(root);
  return tris;
}

// Independent Blender Z-up -> glTF Y-up basis change B = [[1,0,0],[0,0,1],[0,-1,0]]: R_gltf = B * R_blender * B^T.
function independentBlenderToGltfQuat(wxyz: readonly [number, number, number, number]): [number, number, number, number] {
  const B = new Matrix4().set(
    1, 0, 0, 0,
    0, 0, 1, 0,
    0, -1, 0, 0,
    0, 0, 0, 1,
  );
  const BT = B.clone().transpose();
  const rBlender = new Matrix4().makeRotationFromQuaternion(
    new Quaternion(wxyz[1], wxyz[2], wxyz[3], wxyz[0]).normalize(),
  );
  const rGltf = new Matrix4().multiplyMatrices(B, rBlender).multiply(BT);
  const q = new Quaternion().setFromRotationMatrix(rGltf).normalize();
  return [q.x || 0, q.y || 0, q.z || 0, q.w || 0];
}

const desktopInput: SampleInput = {
  local: 0,
  viewport: { w: 1280, h: 800, dpr: 1.5 },
  profile: { quality: 'high', motion: 'full', renderer: 'webgl' },
  interaction: { source: null, token: 0, reaction: null },
  seed: 1,
  ambient: 0,
};

const MANIFESTS = {
  s01: s01Manifest,
  s02: s02Manifest,
  s03: s03Manifest,
  s04: s04Manifest,
  s05: s05Manifest,
  s06: s06Manifest,
  s07: s07Manifest,
} as const;

const PACKED_GLBS: Record<SceneId, string> = {
  s01: 'public/models/s01/s01_hero_v2.glb',
  s02: 'public/models/s02/s02_portal_v2.glb',
  s03: 'public/models/s03/s03_lab_v2.glb',
  s04: 'public/models/s04/s04_idea_v2.glb',
  s05: 'public/models/s05/s05_multiverse_v2.glb',
  s06: 'public/models/s06/s06_dna_v2.glb',
  s07: 'public/models/s07/s07_future_v2.glb',
};

describe('MO-2 hero parity at b = 0 against v2 manifests', () => {
  it.each(SCENE_IDS)('%s matches manifest camera_hero, robot root/yaw/pose, scale and far plane', id => {
    const manifest = MANIFESTS[id];
    const heroSpec = getSceneHero(id);
    const snapshot = scenes[id].sample(desktopInput);
    const placement = robotPlacement(id, snapshot, desktopInput.viewport);

    // Camera position, look direction via quaternion, fov, near/far
    expect(snapshot.camera.position).toEqual(manifest.camera_hero.position_gltf);
    expect(snapshot.camera.fov).toBeCloseTo(manifest.camera_hero.vertical_fov_deg, 5);
    const expectedFar = 'clip' in manifest.camera_hero ? manifest.camera_hero.clip[1] : 100;
    expect(snapshot.camera.far).toBe(expectedFar);

    const forward = new Vector3(0, 0, -1).applyQuaternion(new Quaternion(...snapshot.camera.quaternion)).normalize();
    const expectedDir = new Vector3(...manifest.camera_hero.look_dir_gltf).normalize();
    expect(forward.x).toBeCloseTo(expectedDir.x, 4);
    expect(forward.y).toBeCloseTo(expectedDir.y, 4);
    expect(forward.z).toBeCloseTo(expectedDir.z, 4);

    // Robot root, scale/pivot, and quaternion computed independently from manifest yaw_deg / tilt_deg
    expect(placement.position).toEqual(manifest.robot.root_gltf);
    expect(placement.scale).toBe(1);
    expect(heroSpec.robot.pivot).toBe('bottom');

    const tiltDeg = 'tilt_deg' in manifest.robot ? manifest.robot.tilt_deg : 0;
    const yawDeg = 'yaw_deg' in manifest.robot ? manifest.robot.yaw_deg : 0;
    const deg2rad = Math.PI / 180;
    const expectedRobotQuat = (() => {
      if (tiltDeg !== 0) {
        const qBlender = new Quaternion().setFromEuler(
          new Euler(0, tiltDeg * deg2rad, yawDeg * deg2rad, 'XYZ'),
        );
        return independentBlenderToGltfQuat([qBlender.w, qBlender.x, qBlender.y, qBlender.z]);
      }
      const qYaw = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), yawDeg * deg2rad);
      return [qYaw.x || 0, qYaw.y || 0, qYaw.z || 0, qYaw.w || 0];
    })();
    const actualQ = new Quaternion(...placement.quaternion);
    const expectedQ = new Quaternion(...expectedRobotQuat);
    expect(Math.abs(actualQ.dot(expectedQ))).toBeCloseTo(1, 5);

    // Hero robot directive and runtime joint poses at b = 0
    if (id === 's01' || id === 's05' || id === 's06') {
      expect(snapshot.visual.robotPose).toEqual(heroSpec.robot.jointPosesXyzw);
      expect(Object.keys(snapshot.visual.robotPose as Record<string, unknown>).length).toBeGreaterThan(0);
    }
    if (id === 's01') {
      expect(snapshot.robot).toEqual({ kind: 'clip', name: 'Idle', timeSeconds: 0, weight: 1 });
    }
  });

  it('converts S04 phone Blender pose and Euler XYZ deg to glTF axes matching manifest and GLB', () => {
    const pos = blenderToGltfPosition(s04Manifest.phone_pose.location_blender as [number, number, number]);
    const quat = blenderEulerDegToGltfQuaternion(s04Manifest.phone_pose.rotation_euler_xyz_deg as [number, number, number], 'XYZ');
    pos.forEach((v, i) => expect(v).toBeCloseTo(s04Manifest.phone_pose_gltf.position[i], 6));
    quat.forEach((v, i) => expect(v).toBeCloseTo(s04Manifest.phone_pose_gltf.quaternion_xyzw[i], 6));

    const glb = readGlbJson(PACKED_GLBS.s04);
    const phoneNode = glb.nodes!.find(n => n.name === 'S04_phone')!;
    expect(phoneNode).toBeDefined();
    phoneNode.translation!.forEach((v, i) => expect(v).toBeCloseTo(pos[i], 5));
    phoneNode.rotation!.forEach((v, i) => expect(v).toBeCloseTo(quat[i], 5));
  });

  it('converts Blender Z-up joint quaternions to glTF Y-up and composes accurate world bone targets on robot_high.glb', async () => {
    const sampleWxyz = s06Manifest.robot.pose.Shoulder_L_quat_wxyz as [number, number, number, number];
    const converted = blenderQuatWxyzToGltfXyzw(sampleWxyz);
    const independent = independentBlenderToGltfQuat(sampleWxyz);
    expect(Math.abs(new Quaternion(...converted).dot(new Quaternion(...independent)))).toBeCloseTo(1, 5);

    // Load robot_high.glb (stripping textures/materials so Node needs no browser image decoder) and verify RobotComposer applies hero jointPoses at b = 0
    const source = readFileSync(resolve(process.cwd(), 'public/models/robot/robot_high.glb'));
    const jsonLength = source.readUInt32LE(12);
    const json = JSON.parse(source.subarray(20, 20 + jsonLength).toString('utf8'));
    delete json.materials;
    delete json.textures;
    delete json.images;
    for (const mesh of json.meshes ?? []) {
      for (const primitive of mesh.primitives ?? []) delete primitive.material;
    }
    const serialized = JSON.stringify(json);
    const chunk = Buffer.from(serialized + ' '.repeat((4 - Buffer.byteLength(serialized) % 4) % 4));
    const binary = source.subarray(20 + jsonLength);
    const header = Buffer.alloc(20);
    header.writeUInt32LE(0x46546c67, 0);
    header.writeUInt32LE(2, 4);
    header.writeUInt32LE(20 + chunk.length + binary.length, 8);
    header.writeUInt32LE(chunk.length, 12);
    header.writeUInt32LE(0x4e4f534a, 16);
    const bytes = Buffer.concat([header, chunk, binary]);
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    const mounted = new Group();
    const robot = gltf.scene;
    mounted.add(robot);
    const composer = new RobotComposer();
    composer.bind(robot, gltf.animations);

    const composeHero = (id: 's01' | 's05' | 's06') => {
      const snap = scenes[id].sample(desktopInput);
      const placement = robotPlacement(id, snap, desktopInput.viewport);
      mounted.position.fromArray(placement.position);
      mounted.quaternion.fromArray(placement.quaternion);
      mounted.scale.setScalar(placement.scale);
      mounted.updateMatrixWorld(true);
      composer.compose(snap.robot, {
        time: 0,
        delta: 0,
        reduced: false,
        canLook: false,
        target: null,
        reaction: null,
        jointPoses: snap.visual.robotPose as Record<string, readonly [number, number, number, number]>,
      });
      const shL = new Vector3();
      const handL = new Vector3();
      const shR = new Vector3();
      const handR = new Vector3();
      composer.worldPosition('Shoulder_L', shL);
      composer.worldPosition('LeftHand_Anchor', handL);
      composer.worldPosition('Shoulder_R', shR);
      composer.worldPosition('RightHand_Anchor', handR);
      return { shL, handL, shR, handR, dirL: handL.clone().sub(shL).normalize(), dirR: handR.clone().sub(shR).normalize() };
    };

    // S06: left arm points at helix (+X/+Y, NOT +Z camera); right arm extends forward toward tablet
    const s06Pose = composeHero('s06');
    expect(s06Pose.dirL.x).toBeGreaterThan(0.85);
    expect(s06Pose.dirL.y).toBeGreaterThan(0.35);
    expect(s06Pose.dirL.z).toBeLessThan(0.3);
    const toHelix = new Vector3(...s06Manifest.helix.logo_center_gltf).sub(s06Pose.shL).normalize();
    expect(s06Pose.dirL.dot(toHelix)).toBeGreaterThan(0.75);
    expect(s06Pose.dirR.z).toBeGreaterThan(0.75);

    // S05: left arm points at space between robot and globe (+X/+Y/+Z)
    const s05Pose = composeHero('s05');
    expect(s05Pose.dirL.x).toBeGreaterThan(0.75);
    expect(s05Pose.dirL.y).toBeGreaterThan(0.3);

    // S01: finger rest yaw compensation cancels ±22° rest yaw so Hand_*_Finger_1..4 fan symmetrically
    composeHero('s01');
    const fingerCombined = (nodeName: string) => {
      const joint = robot.getObjectByName(nodeName)!;
      const child = joint.children.find(c => c.name.startsWith('Hand_'))!;
      return joint.quaternion.clone().multiply(child.quaternion).normalize();
    };
    const fingerYaw = (q: Quaternion) => new Euler().setFromQuaternion(q, 'YXZ').y * 180 / Math.PI;
    for (const side of ['R', 'L'] as const) {
      const q1 = fingerCombined(`Finger_1_${side}`);
      const q2 = fingerCombined(`Finger_2_${side}`);
      const q3 = fingerCombined(`Finger_3_${side}`);
      const q4 = fingerCombined(`Finger_4_${side}`);
      expect(Math.abs(q1.clone().multiply(q4).w)).toBeCloseTo(1, 3);
      expect(Math.abs(q2.clone().multiply(q3).w)).toBeCloseTo(1, 3);
      expect(Math.abs(fingerYaw(q1))).toBeGreaterThan(30);
      expect(fingerYaw(q1) * fingerYaw(q4)).toBeLessThan(0);
    }

    // Verify raw xyzw conversion helper matches independent basis transform
    const rawS01ShoulderR = robotClipData.hero_poses.hero_s01.Shoulder_R as [number, number, number, number];
    const convS01 = blenderRawXyzwToGltfXyzw(rawS01ShoulderR);
    const indepS01 = independentBlenderToGltfQuat([rawS01ShoulderR[3], rawS01ShoulderR[0], rawS01ShoulderR[1], rawS01ShoulderR[2]]);
    expect(Math.abs(new Quaternion(...convS01).dot(new Quaternion(...indepS01)))).toBeCloseTo(1, 5);
    expect(applyFingerRestYaw('Shoulder_R', convS01)).toEqual(convS01);

    composer.dispose();

    expect(SCENE_HEROES.s06.stageScale).toBe(0.6);
    const s06Glb = readGlbJson(PACKED_GLBS.s06);
    const stageNode = s06Glb.nodes!.find(n => n.name === s06Manifest.stage.node)!;
    stageNode.scale!.forEach(s => expect(s).toBeCloseTo(0.6, 5));
  });

  it('sets S07 far plane to 3000 for the 900m sky card', () => {
    const snap = scenes.s07.sample(desktopInput);
    expect(snap.camera.far).toBe(s07Manifest.camera_hero.clip[1]);
  });
});

describe('MO-2 matte cards, typed accessors, WebP packing and node rules', () => {
  it('converts S01/S03/S04/S07 matte cards to unlit fog-excluded MeshBasicMaterial with S07 MIRRORED_REPEAT', () => {
    for (const id of ['s01', 's03', 's04', 's07'] as const) {
      const spec = SCENE_HEROES[id].matteCard!;
      const tex = new Texture();
      const std = new MeshStandardMaterial({
        name: spec.material,
        color: new Color(0, 0, 0),
        emissive: new Color(0.6, 0.5, 0.4),
        emissiveMap: tex,
      });
      const mesh = new Mesh(new PlaneGeometry(), std);
      mesh.name = spec.node;
      const owned: MeshBasicMaterial[] = [];
      const created = applyMatteCardMaterial(mesh, spec, owned);
      expect(created).toHaveLength(1);
      const basic = mesh.material as unknown as MeshBasicMaterial;
      expect(basic.isMeshBasicMaterial).toBe(true);
      expect(basic.fog).toBe(false);
      expect(basic.map).toBe(tex);
      expect(basic.color.r).toBeCloseTo(0.6);
      if (id === 's07') {
        expect(basic.depthWrite).toBe(false);
        expect(tex.wrapS).toBe(MirroredRepeatWrapping);
        expect(tex.wrapT).toBe(MirroredRepeatWrapping);
      } else {
        expect(basic.depthWrite).toBe(true);
      }
      basic.dispose();
      tex.dispose();
      std.dispose();
    }
  });

  it('exposes typed S04 exploded parts + cameraSafeRange, S07 fly-in path, and per-scene portrait framing constraints', () => {
    expect(s04PhoneData.explodedParts).toHaveLength(8);
    expect(s04PhoneData.cameraSafeRange.status).toBe('ok');
    expect(s04PhoneData.cameraSafeRange.yaw_deg).toEqual({ min: -0.79, max: 0.79 });
    expect(s07FutureData.flyInPath.control_points_gltf).toHaveLength(4);
    expect(s07FutureData.flyInPath.coverage_samples).toBe(201);
    expect(s07FutureData.backdropOverscan).toEqual({ scale: 1.6, uv_range: [-0.3, 1.3], wrap: 'MIRRORED_REPEAT' });
    expect(s05MultiverseData.globe.radius).toBe(2.36);
    expect(s06DnaData.helix.value_pill_anchors_gltf).toHaveLength(7);
    expect(s03BindingsData.bindings).toHaveLength(26);

    const s04Glb = readGlbJson(PACKED_GLBS.s04);
    for (const part of s04PhoneData.explodedParts) {
      const node = s04Glb.nodes!.find(n => n.name === part.node);
      expect(node, `Missing ${part.node} in s04_idea_v2.glb`).toBeDefined();
      expect(node!.extras?.exploded_direction).toEqual(part.exploded_direction);
      expect(node!.extras?.exploded_distance).toBe(part.exploded_distance);
    }

    for (const id of SCENE_IDS) {
      const pf = SCENE_HEROES[id].portraitFraming;
      expect(pf.aspectThreshold).toBeGreaterThan(0);
      expect(pf.robotAnchorGltf).toHaveLength(3);
      expect(pf.propAnchorGltf).toHaveLength(3);
      expect(pf.note.length).toBeGreaterThan(10);
    }
  });

  it('preserves §7 #7 separate named arm/hand/head nodes in robot GLBs and preserves packed v2 GLB nodes + WebP', () => {
    for (const lod of ['high', 'low'] as const) {
      const robot = readGlbJson(`public/models/robot/robot_${lod}.glb`);
      const names = new Set((robot.nodes ?? []).map(n => n.name));
      for (const required of [
        'Root', 'Torso', 'Neck', 'Head', 'Eye_L', 'Eye_R',
        'Shoulder_L', 'Upper_L', 'Wrist_L', 'Palm_L', 'LeftHand_Anchor',
        'Shoulder_R', 'Upper_R', 'Wrist_R', 'Palm_R', 'RightHand_Anchor',
      ]) {
        expect(names.has(required), `robot_${lod}.glb missing ${required}`).toBe(true);
      }
    }

    for (const id of SCENE_IDS) {
      const src = readGlbJson(`assets-model/export/${MANIFESTS[id].file}`);
      const dst = readGlbJson(PACKED_GLBS[id]);
      expect(dst.nodes!.map(n => n.name)).toEqual(src.nodes!.map(n => n.name));
      expect(countGlbTriangles(dst)).toBe(countGlbTriangles(src));
      expect(dst.extensionsUsed).toContain('EXT_texture_webp');
      for (const img of dst.images ?? []) expect(img.mimeType).toBe('image/webp');
    }

    // S03 arm nodes and S07 sky MIRRORED_REPEAT sampler preserved
    const s03 = readGlbJson(PACKED_GLBS.s03);
    const s03Names = new Set(s03.nodes!.map(n => n.name));
    expect(s03Names.has('S03_arm_L')).toBe(true);
    expect(s03Names.has('S03_arm_R')).toBe(true);
    const s07 = readGlbJson(PACKED_GLBS.s07);
    expect(s07.samplers![0].wrapS).toBe(33648);
    expect(s07.samplers![0].wrapT).toBe(33648);
  });
});

function geometryTris(geom: BufferGeometry): number {
  const index = geom.getIndex();
  const tris = (index ? index.count : geom.getAttribute('position').count) / 3;
  geom.dispose();
  return tris;
}

describe('MO-2 §8 triangle budgets per scene (<= 100k)', () => {
  it('stays strictly within 100,000 triangles per frame across all 7 scenes', () => {
    const robotHighTris = countGlbTriangles(readGlbJson('public/models/robot/robot_high.glb'));
    const robotLowTris = countGlbTriangles(readGlbJson('public/models/robot/robot_low.glb'));

    // S03 reused demo prop triangles from station_1..6.glb
    const stationCache = new Map<string, GlbJson>();
    let demoPropsTris = 0;
    for (const binding of s03Bindings.bindings) {
      let json = stationCache.get(binding.sourceGlb);
      if (!json) {
        json = readGlbJson(`public/models/lab/${binding.sourceGlb}`);
        stationCache.set(binding.sourceGlb, json);
      }
      demoPropsTris += countNodeTriangles(json, binding.sourceNode);
    }
    expect(demoPropsTris).toBe(7366);

    const logo3dTris = countGlbTriangles(readGlbJson('public/models/s06/logo_3d.glb'));

    // S07 procedural meshes (S07_EnergyCore + S07_Shapes)
    const s07ProceduralTris =
      geometryTris(new IcosahedronGeometry(0.22, 2)) +
      geometryTris(new SphereGeometry(0.3, 16, 16)) +
      geometryTris(new RingGeometry(0.35, 0.38, 32)) +
      geometryTris(new BoxGeometry(0.7, 0.45, 0.04)) +
      geometryTris(new PlaneGeometry(0.64, 0.39)) * 2 +
      geometryTris(new BoxGeometry(0.3, 0.58, 0.035)) +
      geometryTris(new PlaneGeometry(0.26, 0.52)) +
      geometryTris(new BoxGeometry(0.1, 0.22, 0.1)) * 3 +
      geometryTris(new OctahedronGeometry(0.28, 0)) +
      geometryTris(new TorusGeometry(0.38, 0.02, 16, 48));

    const extraTris: Partial<Record<SceneId, number>> = {
      s03: demoPropsTris,
      s06: logo3dTris,
      s07: s07ProceduralTris,
    };

    for (const id of SCENE_IDS) {
      const robotTris = SCENE_HEROES[id].robot.lod === 'low' ? robotLowTris : robotHighTris;
      const total = countGlbTriangles(readGlbJson(PACKED_GLBS[id])) + robotTris + (extraTris[id] ?? 0);
      expect(total, `${id} triangle budget exceeded: ${total}`).toBeLessThanOrEqual(100_000);
    }
  });
});
