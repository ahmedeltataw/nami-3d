import { model, poster } from '../../assets/helpers';
import { kitAssetSpec } from '../manifests';

const kit = kitAssetSpec('s07');

export const s07Assets = {
  'poster:s07': poster('s07'),
  's07.kit': model(kit.url, kit.bytes, kit.owners),
} as const;
