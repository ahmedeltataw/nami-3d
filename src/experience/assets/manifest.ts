import type { SceneId } from '../contracts';
import type { Profile } from '../profile';
import { worlds, type WorldSlug } from '../scenes/s05/projects';

export type AssetKey = `poster:${SceneId}` | 'robot.high' | 'robot.low' | 'lab.shell' | 'arms' | `station.${1 | 2 | 3 | 4 | 5 | 6}` | 'gallery.shell' | 'gallery.portal' | `world.${WorldSlug}`;
export const robotAssetKey = (quality: Profile['quality']): AssetKey => quality === 'high' ? 'robot.high' : 'robot.low';
export type AssetDecoder = 'none' | 'ktx2' | 'gltf';
export type AssetEntry = {
  url: Record<Profile['quality'], string>;
  owners: readonly SceneId[];
  bytes: number;
  decoder: AssetDecoder;
};

function poster(id: SceneId): AssetEntry {
  const url = `/posters/${id}.svg`;
  return { url: { high: url, mid: url, low: url }, owners: [id], bytes: 326, decoder: 'none' };
}

export const manifest: Record<AssetKey, AssetEntry> = {
  'gallery.shell': gallery('gallery_shell', 557472, ['s05']),
  'gallery.portal': gallery('portal_gate', 506664, ['s05']),
  ...Object.fromEntries(worlds.map((world, index) => [`world.${world.slug}`, gallery(`world_${world.slug}`, [218948, 284416, 285036, 270924, 212076, 302464][index], [])])) as Record<`world.${WorldSlug}`, AssetEntry>,
  'lab.shell': lab('lab_shell', 1091344),
  'station.1': lab('station_1_web', 99080),
  'station.2': lab('station_2_mobile', 47196),
  'station.3': lab('station_3_marketing', 153448),
  'station.4': lab('station_4_consulting', 120984),
  'station.5': lab('station_5_cloud', 215060),
  'station.6': lab('station_6_design', 154384),
  arms: lab('mechanical_arms', 244904),
  'robot.high': { url: { high: '/models/robot/robot_high.glb', mid: '/models/robot/robot_high.glb', low: '/models/robot/robot_high.glb' }, owners: [], bytes: 1945564, decoder: 'gltf' },
  'robot.low': { url: { high: '/models/robot/robot_low.glb', mid: '/models/robot/robot_low.glb', low: '/models/robot/robot_low.glb' }, owners: [], bytes: 1250568, decoder: 'gltf' },
  'poster:s01': poster('s01'),
  'poster:s02': poster('s02'),
  'poster:s03': poster('s03'),
  'poster:s04': poster('s04'),
  'poster:s05': poster('s05'),
  'poster:s06': poster('s06'),
  'poster:s07': poster('s07'),
};

function gallery(file: string, bytes: number, owners: SceneId[]): AssetEntry {
  const url = `/models/gallery/${file}.glb`;
  return { url: { high: url, mid: url, low: url }, owners, bytes, decoder: 'gltf' };
}

function lab(file: string, bytes: number): AssetEntry {
  const url = `/models/lab/${file}.glb`;
  return { url: { high: url, mid: url, low: url }, owners: ['s03'], bytes, decoder: 'gltf' };
}
