import type { SceneId } from '../contracts';
import type { Profile } from '../profile';

export type AssetKey = `poster:${SceneId}` | 'robot.high' | 'robot.low';
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
  'robot.high': { url: { high: '/models/robot/robot_high.glb', mid: '/models/robot/robot_high.glb', low: '/models/robot/robot_high.glb' }, owners: [], bytes: 1826712, decoder: 'gltf' },
  'robot.low': { url: { high: '/models/robot/robot_low.glb', mid: '/models/robot/robot_low.glb', low: '/models/robot/robot_low.glb' }, owners: [], bytes: 1131824, decoder: 'gltf' },
  'poster:s01': poster('s01'),
  'poster:s02': poster('s02'),
  'poster:s03': poster('s03'),
  'poster:s04': poster('s04'),
  'poster:s05': poster('s05'),
  'poster:s06': poster('s06'),
  'poster:s07': poster('s07'),
};
