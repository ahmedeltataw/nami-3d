import type { SceneId } from '../../contracts';
import { model, poster } from '../../assets/helpers';
import type { AssetEntry } from '../../assets/types';
import { worlds, type WorldSlug } from './projects';

export const s05Assets = {
  'gallery.shell': gallery('gallery_shell', 557472, ['s05']),
  'gallery.portal': gallery('portal_gate', 506664, ['s05']),
  ...Object.fromEntries(worlds.map((world, index) => [`world.${world.slug}`, gallery(`world_${world.slug}`, [218948, 284416, 285036, 270924, 212076, 302464][index], [])])) as Record<`world.${WorldSlug}`, AssetEntry>,
  'poster:s05': poster('s05'),
} as const;

function gallery(file: string, bytes: number, owners: readonly SceneId[]) {
  return model(`/models/gallery/${file}.glb`, bytes, owners);
}
