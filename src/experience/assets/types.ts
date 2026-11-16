import type { SceneId } from '../contracts';
import type { Profile } from '../profile';

export type AssetDecoder = 'none' | 'ktx2' | 'gltf';
export type AssetEntry = {
  url: Record<Profile['quality'], string>;
  owners: readonly SceneId[];
  bytes: number;
  decoder: AssetDecoder;
};
