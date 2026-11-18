import { model, poster } from '../../assets/helpers';
import { kitAssetSpec } from '../manifests';

const kit = kitAssetSpec('s06');

export const s06Assets = {
  'poster:s06': poster('s06'),
  's06.kit': model(kit.url, kit.bytes, kit.owners),
  'logo.3d': model('/models/s06/logo_3d.glb', 428652, ['s06']),
} as const;
