import type { AssetKey } from '../contracts';
import type { AssetLease, AssetResidency } from '../assets/residency';

// Acquire the entire new set before releasing any old leases, including shared assets.
export class TransitionResidency {
  private leases = new Map<AssetKey, AssetLease>();
  private version = 0;
  constructor(private readonly residency: AssetResidency) {}

  update(required: readonly AssetKey[], warm: readonly AssetKey[], ready: () => void, failed: (error: unknown) => void) {
    const version = ++this.version;
    const desired = new Set([...required, ...warm]);
    for (const key of desired) {
      if (this.leases.has(key)) continue;
      const lease = this.residency.acquire(key);
      this.leases.set(key, lease);
      void lease.ready.catch(() => {});
    }
    for (const [key, lease] of this.leases) {
      if (desired.has(key)) continue;
      lease.release();
      this.leases.delete(key);
    }
    this.residency.evictUnused();
    void Promise.all(required.map(key => this.leases.get(key)!.ready)).then(() => {
      if (version === this.version) ready();
    }).catch(error => { if (version === this.version) failed(error); });
  }

  release() {
    this.version++;
    for (const lease of this.leases.values()) lease.release();
    this.leases.clear();
  }
}
