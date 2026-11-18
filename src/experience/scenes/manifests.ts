import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { SceneId } from '../contracts';
import type { MatteCardSpec } from '../assets/matte';
import robotClipData from '../../../assets-model/export/robot_clip_data.json';
import s01Manifest from '../../../assets-model/export/s01_hero_v2.manifest.json';
import s02Manifest from '../../../assets-model/export/s02_portal_v2.manifest.json';
import s03Manifest from '../../../assets-model/export/s03_lab_v2.manifest.json';
import s03DemoBindingsJson from '../../../assets-model/export/s03_demo_bindings.json';
import s04Manifest from '../../../assets-model/export/s04_idea_v2.manifest.json';
import s05Manifest from '../../../assets-model/export/s05_multiverse_v2.manifest.json';
import s06Manifest from '../../../assets-model/export/s06_dna_v2.manifest.json';
import s07Manifest from '../../../assets-model/export/s07_future_v2.manifest.json';

export type Vec3Tuple = readonly [number, number, number];
export type QuatTuple = readonly [number, number, number, number];

export interface PortraitFramingConstraint {
  readonly aspectThreshold: number;
  readonly robotAnchorGltf: Vec3Tuple;
  readonly propAnchorGltf: Vec3Tuple;
  readonly matteCardConstrained: boolean;
  readonly recommendedPullbackM: number;
  readonly portraitOffsetGltf: Vec3Tuple;
  readonly maxSafeFovDeg: number;
  readonly note: string;
}

export interface SceneHeroSpec {
  readonly id: SceneId;
  readonly kitFile: string;
  readonly packedBytes: number;
  readonly trisTotal: number;
  readonly camera: {
    readonly position: [number, number, number];
    readonly lookDir: [number, number, number];
    readonly quaternion: [number, number, number, number];
    readonly fov: number;
    readonly near: number;
    readonly far: number;
  };
  readonly robot: {
    readonly lod: 'high' | 'low';
    readonly rootPosition: [number, number, number];
    readonly yawDeg: number;
    readonly tiltDeg: number;
    readonly quaternion: [number, number, number, number];
    readonly scale: number;
    readonly pivot: 'bottom';
    readonly jointPosesXyzw: Record<string, [number, number, number, number]>;
  };
  readonly stageScale?: number;
  readonly matteCard?: MatteCardSpec;
  readonly portraitFraming: PortraitFramingConstraint;
}

const vec3 = (v: readonly number[]): Vec3Tuple => [v[0], v[1], v[2]];
const quat = (q: readonly number[]): QuatTuple => [q[0], q[1], q[2], q[3]];

const ZERO = new Vector3(0, 0, 0);
const UP = new Vector3(0, 1, 0);
const DEG2RAD = Math.PI / 180;

/**
 * Converts a Blender Z-up `[w, x, y, z]` joint quaternion into glTF Y-up `[x, y, z, w]`
 * via the basis change `B = [[1,0,0],[0,0,1],[0,-1,0]]` (`[q[1], q[3], -q[2], q[0]]`).
 */
export function blenderQuatWxyzToGltfXyzw(q: readonly [number, number, number, number]): [number, number, number, number] {
  const out = new Quaternion(q[1], q[3], -q[2], q[0]).normalize();
  return [out.x || 0, out.y || 0, out.z || 0, out.w || 0];
}

/**
 * Converts a Blender-basis `[x, y, z, w]` quaternion (as stored in `robot_clip_data.json`)
 * into glTF Y-up `[x, y, z, w]` via `B = [[1,0,0],[0,0,1],[0,-1,0]]`.
 */
export function blenderRawXyzwToGltfXyzw(q: readonly [number, number, number, number]): [number, number, number, number] {
  return blenderQuatWxyzToGltfXyzw([q[3], q[0], q[1], q[2]]);
}

/**
 * Compensates for the `±22°` glTF rest yaw baked onto `Finger_*_L` (`+22°`) and `Finger_*_R` (`-22°`)
 * and their inverse on `Hand_*_Finger_*` child meshes in `robot_high.glb`.
 */
export function applyFingerRestYaw(joint: string, qGltf: readonly [number, number, number, number]): [number, number, number, number] {
  const match = /^Finger_\d+_(L|R)$/.exec(joint);
  if (!match) return [...qGltf] as [number, number, number, number];
  const restYawDeg = match[1] === 'L' ? 22 : -22;
  const qRest = new Quaternion().setFromAxisAngle(UP, restYawDeg * DEG2RAD);
  const q = new Quaternion(qGltf[0], qGltf[1], qGltf[2], qGltf[3]).multiply(qRest).normalize();
  return [q.x || 0, q.y || 0, q.z || 0, q.w || 0];
}

/** Converts Blender Z-up coordinates `[x, y, z]` to glTF Y-up `[x, z, -y]`. */
export function blenderToGltfPosition(pos: Vec3Tuple): [number, number, number] {
  return [pos[0], pos[2], -pos[1]];
}

/**
 * Converts Blender Euler angles (degrees) into a glTF-space `[x, y, z, w]` quaternion.
 * Blender `'XYZ'` applies Rx then Ry then Rz (extrinsic), matching Three.js intrinsic `'ZYX'`.
 * Blender `'ZYX'` applies Rz then Ry then Rx (extrinsic), matching Three.js intrinsic `'XYZ'`.
 */
export function blenderEulerDegToGltfQuaternion(
  deg: Vec3Tuple,
  blenderOrder: 'XYZ' | 'ZYX' = 'XYZ',
): [number, number, number, number] {
  const threeOrder = blenderOrder === 'XYZ' ? 'ZYX' : 'XYZ';
  const qBlender = new Quaternion().setFromEuler(
    new Euler(deg[0] * DEG2RAD, deg[1] * DEG2RAD, deg[2] * DEG2RAD, threeOrder),
  );
  return [qBlender.x, qBlender.z, -qBlender.y, qBlender.w];
}

export function cameraQuaternionFromLookDir(dir: Vec3Tuple): [number, number, number, number] {
  const target = new Vector3(dir[0], dir[1], dir[2]).normalize();
  const matrix = new Matrix4().lookAt(ZERO, target, UP);
  const q = new Quaternion().setFromRotationMatrix(matrix);
  return [q.x || 0, q.y || 0, q.z || 0, q.w || 0];
}

export function robotQuaternionFromYawTilt(yawDeg: number, tiltDeg = 0): [number, number, number, number] {
  if (tiltDeg !== 0) {
    return blenderEulerDegToGltfQuaternion([0, tiltDeg, yawDeg], 'ZYX');
  }
  const q = new Quaternion().setFromAxisAngle(UP, yawDeg * DEG2RAD);
  return [q.x || 0, q.y || 0, q.z || 0, q.w || 0];
}

function buildCamera(hero: {
  readonly position_gltf: readonly number[];
  readonly look_dir_gltf: readonly number[];
  readonly vertical_fov_deg: number;
  readonly clip?: readonly number[];
}) {
  const position = [hero.position_gltf[0], hero.position_gltf[1], hero.position_gltf[2]] as [number, number, number];
  const lookDir = [hero.look_dir_gltf[0], hero.look_dir_gltf[1], hero.look_dir_gltf[2]] as [number, number, number];
  return {
    position,
    lookDir,
    quaternion: cameraQuaternionFromLookDir(lookDir),
    fov: hero.vertical_fov_deg,
    near: hero.clip?.[0] ?? 0.1,
    far: hero.clip?.[1] ?? 100,
  };
}

interface ManifestPortraitFraming {
  readonly aspect_threshold: number;
  readonly matte_card_constrained: boolean;
  readonly recommended_pullback_m: number;
  readonly portrait_offset_gltf: readonly number[];
  readonly max_safe_fov_deg: number;
  readonly note: string;
}

interface ManifestMatteCard {
  readonly node: string;
  readonly material: string;
  readonly depth_write?: boolean;
  readonly wrap?: string;
}

function buildPortraitFraming(
  raw: ManifestPortraitFraming,
  robotAnchor: readonly number[],
  propAnchor: readonly number[],
): PortraitFramingConstraint {
  return {
    aspectThreshold: raw.aspect_threshold,
    robotAnchorGltf: vec3(robotAnchor),
    propAnchorGltf: vec3(propAnchor),
    matteCardConstrained: raw.matte_card_constrained,
    recommendedPullbackM: raw.recommended_pullback_m,
    portraitOffsetGltf: vec3(raw.portrait_offset_gltf),
    maxSafeFovDeg: raw.max_safe_fov_deg,
    note: raw.note,
  };
}

function buildMatteCard(raw: ManifestMatteCard): MatteCardSpec {
  return {
    node: raw.node,
    material: raw.material,
    ...(raw.depth_write !== undefined ? { depthWrite: raw.depth_write } : {}),
    ...(raw.wrap ? { wrap: raw.wrap as 'MIRRORED_REPEAT' } : {}),
  };
}

const s01JointPoses = Object.fromEntries(
  Object.entries(robotClipData.hero_poses.hero_s01).map(([joint, rawXyzw]) => [
    joint,
    applyFingerRestYaw(joint, blenderRawXyzwToGltfXyzw(quat(rawXyzw))),
  ]),
);

export const SCENE_HEROES: Record<SceneId, SceneHeroSpec> = {
  s01: {
    id: 's01',
    kitFile: s01Manifest.file,
    packedBytes: s01Manifest.packed_bytes,
    trisTotal: s01Manifest.tris_total,
    camera: buildCamera(s01Manifest.camera_hero),
    robot: {
      lod: 'high',
      rootPosition: [...s01Manifest.robot.root_gltf] as [number, number, number],
      yawDeg: s01Manifest.robot.yaw_deg,
      tiltDeg: s01Manifest.robot.tilt_deg,
      quaternion: robotQuaternionFromYawTilt(s01Manifest.robot.yaw_deg, s01Manifest.robot.tilt_deg),
      scale: 1,
      pivot: 'bottom',
      jointPosesXyzw: s01JointPoses,
    },
    matteCard: buildMatteCard(s01Manifest.matte_card),
    portraitFraming: buildPortraitFraming(s01Manifest.portrait_framing, s01Manifest.robot.root_gltf, s01Manifest.disc.centre_gltf),
  },
  s02: {
    id: 's02',
    kitFile: s02Manifest.file,
    packedBytes: s02Manifest.packed_bytes,
    trisTotal: s02Manifest.tris_total,
    camera: buildCamera(s02Manifest.camera_hero),
    robot: {
      lod: 'high',
      rootPosition: [...s02Manifest.robot.root_gltf] as [number, number, number],
      yawDeg: s02Manifest.robot.yaw_deg,
      tiltDeg: 0,
      quaternion: robotQuaternionFromYawTilt(s02Manifest.robot.yaw_deg),
      scale: 1,
      pivot: 'bottom',
      jointPosesXyzw: {},
    },
    portraitFraming: buildPortraitFraming(s02Manifest.portrait_framing, s02Manifest.robot.root_gltf, s02Manifest.portal.centre_gltf),
  },
  s03: {
    id: 's03',
    kitFile: s03Manifest.file,
    packedBytes: s03Manifest.packed_bytes,
    trisTotal: s03Manifest.tris_total,
    camera: buildCamera(s03Manifest.camera_hero),
    robot: {
      lod: 'low',
      rootPosition: [...s03Manifest.robot.root_gltf] as [number, number, number],
      yawDeg: 0,
      tiltDeg: 0,
      quaternion: robotQuaternionFromYawTilt(0),
      scale: 1,
      pivot: 'bottom',
      jointPosesXyzw: {},
    },
    matteCard: buildMatteCard(s03Manifest.matte_card),
    portraitFraming: buildPortraitFraming(s03Manifest.portrait_framing, s03Manifest.robot.root_gltf, s03Manifest.platform.centre_gltf),
  },
  s04: {
    id: 's04',
    kitFile: s04Manifest.file,
    packedBytes: s04Manifest.packed_bytes,
    trisTotal: s04Manifest.tris_total,
    camera: buildCamera(s04Manifest.camera_hero),
    robot: {
      lod: 'high',
      rootPosition: [...s04Manifest.robot.root_gltf] as [number, number, number],
      yawDeg: s04Manifest.robot.yaw_deg,
      tiltDeg: 0,
      quaternion: robotQuaternionFromYawTilt(s04Manifest.robot.yaw_deg),
      scale: 1,
      pivot: 'bottom',
      jointPosesXyzw: {},
    },
    matteCard: buildMatteCard(s04Manifest.matte_card),
    portraitFraming: buildPortraitFraming(s04Manifest.portrait_framing, s04Manifest.robot.root_gltf, s04Manifest.phone_pose_gltf.position),
  },
  s05: {
    id: 's05',
    kitFile: s05Manifest.file,
    packedBytes: s05Manifest.packed_bytes,
    trisTotal: s05Manifest.tris_total,
    camera: buildCamera(s05Manifest.camera_hero),
    robot: {
      lod: 'high',
      rootPosition: [...s05Manifest.robot.root_gltf] as [number, number, number],
      yawDeg: s05Manifest.robot.yaw_deg,
      tiltDeg: 0,
      quaternion: robotQuaternionFromYawTilt(s05Manifest.robot.yaw_deg),
      scale: 1,
      pivot: 'bottom',
      jointPosesXyzw: {
        Shoulder_L: blenderQuatWxyzToGltfXyzw(quat(s05Manifest.robot.pose.Shoulder_L_quat_wxyz)),
      },
    },
    portraitFraming: buildPortraitFraming(s05Manifest.portrait_framing, s05Manifest.robot.root_gltf, s05Manifest.globe.centre_gltf),
  },
  s06: {
    id: 's06',
    kitFile: s06Manifest.file,
    packedBytes: s06Manifest.packed_bytes,
    trisTotal: s06Manifest.tris_total,
    camera: buildCamera(s06Manifest.camera_hero),
    robot: {
      lod: 'high',
      rootPosition: [...s06Manifest.robot.root_gltf] as [number, number, number],
      yawDeg: s06Manifest.robot.yaw_deg,
      tiltDeg: 0,
      quaternion: robotQuaternionFromYawTilt(s06Manifest.robot.yaw_deg),
      scale: 1,
      pivot: 'bottom',
      jointPosesXyzw: {
        Shoulder_L: blenderQuatWxyzToGltfXyzw(quat(s06Manifest.robot.pose.Shoulder_L_quat_wxyz)),
        Shoulder_R: blenderQuatWxyzToGltfXyzw(quat(s06Manifest.robot.pose.Shoulder_R_quat_wxyz)),
      },
    },
    stageScale: s06Manifest.stage.scale,
    portraitFraming: buildPortraitFraming(s06Manifest.portrait_framing, s06Manifest.robot.root_gltf, s06Manifest.helix.logo_center_gltf),
  },
  s07: {
    id: 's07',
    kitFile: s07Manifest.file,
    packedBytes: s07Manifest.packed_bytes,
    trisTotal: s07Manifest.tris_total,
    camera: buildCamera(s07Manifest.camera_hero),
    robot: {
      lod: 'high',
      rootPosition: [...s07Manifest.robot.root_gltf] as [number, number, number],
      yawDeg: s07Manifest.robot.yaw_deg,
      tiltDeg: 0,
      quaternion: robotQuaternionFromYawTilt(s07Manifest.robot.yaw_deg),
      scale: 1,
      pivot: 'bottom',
      jointPosesXyzw: {},
    },
    matteCard: buildMatteCard(s07Manifest.matte_card),
    portraitFraming: buildPortraitFraming(s07Manifest.portrait_framing, s07Manifest.robot.root_gltf, s07Manifest.logo.centre_gltf),
  },
};

export function getSceneHero(id: SceneId): SceneHeroSpec {
  return SCENE_HEROES[id];
}

export function kitAssetSpec(id: SceneId) {
  const hero = SCENE_HEROES[id];
  return {
    url: `/models/${id}/${hero.kitFile}`,
    bytes: hero.packedBytes,
    owners: [id] as readonly SceneId[],
  };
}

// ---------- Data-only accessors for downstream cards (MO-4, MO-5, MO-6, MO-8, MO-10) ----------

export type S03DemoBinding = (typeof s03DemoBindingsJson)['bindings'][number];
export type S03DemoPedestal = (typeof s03DemoBindingsJson)['pedestals'][keyof typeof s03DemoBindingsJson.pedestals];

export const s02PortalData = s02Manifest.portal;

export const s03BindingsData = {
  pedestals: s03DemoBindingsJson.pedestals,
  roles: s03DemoBindingsJson.roles,
  bindings: s03DemoBindingsJson.bindings,
  summary: s03DemoBindingsJson.summary,
  cards: s03Manifest.cards,
  stationCameras: s03Manifest.mo2a_station_camera_keys,
} as const;

export const s04PhoneData = {
  poseBlender: s04Manifest.phone_pose,
  poseGltf: s04Manifest.phone_pose_gltf,
  explodedDirectionSpace: s04Manifest.phone_exploded_direction_space,
  explodedParts: s04Manifest.phone_exploded_parts,
  cameraSafeRange: s04Manifest.cameraSafeRange,
} as const;

export const s05MultiverseData = {
  globe: s05Manifest.globe,
  bubbles: s05Manifest.bubbles,
} as const;

export const s06DnaData = {
  stage: s06Manifest.stage,
  helix: s06Manifest.helix,
  heldProp: s06Manifest.held_prop,
} as const;

export const s07FutureData = {
  flyInPath: s07Manifest.mo2a_jump6_camera,
  backdropOverscan: s07Manifest.backdrop_overscan,
  logo: s07Manifest.logo,
  orbit: s07Manifest.orbit,
  trail: s07Manifest.trail,
} as const;
