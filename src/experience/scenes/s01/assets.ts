import { model, poster } from '../../assets/helpers';
import { kitAssetSpec } from '../manifests';

const kit = kitAssetSpec('s01');

export const s01Assets = {
  's01.kit': model(kit.url, kit.bytes, kit.owners),
  'poster:s01': poster('s01'),
} as const;
