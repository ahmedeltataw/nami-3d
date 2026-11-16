import type { Profile } from '../profile';
import { s01Assets } from '../scenes/s01/assets';
import { s02Assets } from '../scenes/s02/assets';
import { s03Assets } from '../scenes/s03/assets';
import { s04Assets } from '../scenes/s04/assets';
import { s05Assets } from '../scenes/s05/assets';
import { s06Assets } from '../scenes/s06/assets';
import { s07Assets } from '../scenes/s07/assets';
import { sharedAssets } from './shared';
import type { AssetEntry } from './types';

export type { AssetDecoder, AssetEntry } from './types';

export const manifest = {
  ...sharedAssets,
  ...s01Assets,
  ...s02Assets,
  ...s03Assets,
  ...s04Assets,
  ...s05Assets,
  ...s06Assets,
  ...s07Assets,
} as const satisfies Record<string, AssetEntry>;

export type AssetKey = keyof typeof manifest;
export const robotAssetKey = (quality: Profile['quality']): AssetKey => quality === 'high' ? 'robot.high' : 'robot.low';
