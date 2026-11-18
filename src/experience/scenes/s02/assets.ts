import { model, poster } from '../../assets/helpers';
import { kitAssetSpec } from '../manifests';

const kit = kitAssetSpec('s02');

export const s02Assets = {
  's02.kit': model(kit.url, kit.bytes, kit.owners),
  'poster:s02': poster('s02'),
} as const;
