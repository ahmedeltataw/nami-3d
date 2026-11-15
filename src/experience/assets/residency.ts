import type { SceneId } from '../contracts';
import type { Profile } from '../profile';
import { manifest, type AssetKey } from './manifest';

export interface ResidentAsset { value: unknown; dispose(): void }
export type AssetLoader = (key: AssetKey, quality: Profile['quality'], signal: AbortSignal) => Promise<ResidentAsset>;
export interface AssetLease { ready: Promise<ResidentAsset>; release(): void }
type Entry = { refs: number; abort: AbortController; ready: Promise<ResidentAsset>; asset?: ResidentAsset };

export class AssetResidency {
  private entries = new Map<AssetKey, Entry>();
  constructor(private readonly load: AssetLoader, private readonly quality: Profile['quality']) {}

  acquire(key: AssetKey, signal?: AbortSignal): AssetLease {
    if (signal?.aborted) return { ready: Promise.reject(new DOMException('Cancelled', 'AbortError')), release() {} };
    let entry = this.entries.get(key);
    if (!entry) {
      const abort = new AbortController();
      const next: Entry = { refs: 0, abort, ready: Promise.resolve().then(() => {
        abort.signal.throwIfAborted();
        return this.load(key, this.quality, abort.signal);
      }) };
      next.ready = next.ready.then(asset => {
        if (abort.signal.aborted) {
          asset.dispose();
          throw new DOMException('Cancelled', 'AbortError');
        }
        next.asset = asset;
        return asset;
      }).catch(error => {
        if (this.entries.get(key) === next) this.entries.delete(key);
        throw error;
      });
      this.entries.set(key, next);
      entry = next;
    }
    entry.refs++;
    const current = entry;
    let released = false;
    let rejectCancellation: (reason: Error) => void = () => {};
    const cancelled = new Promise<never>((_, reject) => { rejectCancellation = reject; });
    const release = () => {
      if (released) return;
      released = true;
      signal?.removeEventListener('abort', release);
      rejectCancellation(new DOMException('Cancelled', 'AbortError'));
      current.refs--;
      if (current.refs === 0 && !current.asset) {
        current.abort.abort();
        if (this.entries.get(key) === current) this.entries.delete(key);
      }
    };
    signal?.addEventListener('abort', release, { once: true });
    return { ready: Promise.race([current.ready, cancelled]), release };
  }

  evict(key: AssetKey): boolean {
    const entry = this.entries.get(key);
    if (!entry || entry.refs > 0) return false;
    entry.abort.abort();
    entry.asset?.dispose();
    this.entries.delete(key);
    return true;
  }

  evictUnused() { for (const key of this.entries.keys()) this.evict(key); }
  consumers(key: AssetKey) { return this.entries.get(key)?.refs ?? 0; }
  isResident(key: AssetKey) { return this.entries.get(key)?.asset !== undefined; }

  prefetch(keys: readonly AssetKey[], signal?: AbortSignal): AssetLease[] {
    return keys.map(key => this.acquire(key, signal));
  }
}

export function keysForScene(scene: SceneId): AssetKey[] {
  return (Object.keys(manifest) as AssetKey[]).filter(key => manifest[key].owners.includes(scene));
}

// Destination leases are issued before neighbors, including on a deep link or context restore.
export function acquireDestination(residency: AssetResidency, scene: SceneId, signal: AbortSignal) {
  const destination = residency.prefetch(keysForScene(scene), signal);
  const ready = Promise.all(destination.map(lease => lease.ready));
  const neighbors: AssetLease[] = [];
  void ready.then(() => {
    if (signal.aborted) return;
    const number = Number(scene.slice(1));
    for (const index of [number - 1, number + 1]) {
      if (index < 1 || index > 7) continue;
      const id = `s0${index}` as SceneId;
      for (const lease of residency.prefetch(keysForScene(id), signal)) {
        neighbors.push(lease);
        void lease.ready.catch(() => {});
      }
    }
  }).catch(() => {});
  return {
    ready,
    release() {
      destination.forEach(lease => lease.release());
      neighbors.forEach(lease => lease.release());
    },
  };
}
