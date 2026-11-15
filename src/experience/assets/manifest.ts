import type { SceneId } from '../contracts';
import type { Profile } from '../profile';

export type AssetKey = `poster:${SceneId}`;
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
  'poster:s01': poster('s01'),
  'poster:s02': poster('s02'),
  'poster:s03': poster('s03'),
  'poster:s04': poster('s04'),
  'poster:s05': poster('s05'),
  'poster:s06': poster('s06'),
  'poster:s07': poster('s07'),
};
