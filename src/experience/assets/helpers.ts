import type { SceneId } from '../contracts';
import type { AssetEntry } from './types';

export function poster(id: SceneId): AssetEntry {
  const url = `/posters/${id}.svg`;
  return { url: { high: url, mid: url, low: url }, owners: [id], bytes: 326, decoder: 'none' };
}

export function model(url: string, bytes: number, owners: readonly SceneId[]): AssetEntry {
  return { url: { high: url, mid: url, low: url }, owners, bytes, decoder: 'gltf' };
}
