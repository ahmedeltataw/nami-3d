import { model, poster } from '../../assets/helpers';
import { kitAssetSpec } from '../manifests';

const kit = kitAssetSpec('s04');

export const s04Assets = {
  's04.kit': model(kit.url, kit.bytes, kit.owners),
  'poster:s04': poster('s04'),
} as const;
