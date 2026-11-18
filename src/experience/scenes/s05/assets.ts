import type { SceneId } from '../../contracts';
import { model, poster } from '../../assets/helpers';
import type { AssetEntry } from '../../assets/types';
import { kitAssetSpec } from '../manifests';
import { worlds, type WorldSlug } from './projects';

const kit = kitAssetSpec('s05');

export const s05Assets = {
  's05.kit': model(kit.url, kit.bytes, kit.owners),
  ...Object.fromEntries(worlds.map((world, index) => [`world.${world.slug}`, gallery(`world_${world.slug}`, [218948, 284416, 285036, 270924, 212076, 302464][index], [])])) as Record<`world.${WorldSlug}`, AssetEntry>,
  'poster:s05': poster('s05'),
} as const;

function gallery(file: string, bytes: number, owners: readonly SceneId[]) {
  return model(`/models/gallery/${file}.glb`, bytes, owners);
}
