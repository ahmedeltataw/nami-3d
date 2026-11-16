import { describe, expect, it, vi } from 'vitest';
import { acquireDestination, AssetResidency, type ResidentAsset } from '../../src/experience/assets/residency';
import type { AssetKey } from '../../src/experience/assets/manifest';

describe('asset residency', () => {
  it('shares loads, counts leases and refuses disposal while consumed', async () => {
    const dispose = vi.fn();
    const load = vi.fn(async () => ({ value: 'asset', dispose }));
    const residency = new AssetResidency(load, 'mid');
    const first = residency.acquire('poster:s01');
    const second = residency.acquire('poster:s01');
    expect(await first.ready).toBe(await second.ready);
    expect(load).toHaveBeenCalledOnce();
    expect(residency.consumers('poster:s01')).toBe(2);
    first.release();
    first.release();
    expect(residency.evict('poster:s01')).toBe(false);
    expect(dispose).not.toHaveBeenCalled();
    second.release();
    expect(residency.evict('poster:s01')).toBe(true);
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('cancels one lease without aborting the other consumer', async () => {
    let resolve!: (value: ResidentAsset) => void;
    let signal!: AbortSignal;
    const residency = new AssetResidency((_key, _quality, current) => { signal = current; return new Promise(done => { resolve = done; }); }, 'low');
    const abort = new AbortController();
    const first = residency.acquire('poster:s02', abort.signal);
    const second = residency.acquire('poster:s02');
    const rejection = expect(first.ready).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve();
    abort.abort();
    await rejection;
    expect(signal.aborted).toBe(false);
    resolve({ value: 1, dispose() {} });
    await second.ready;
    second.release();
    residency.evictUnused();
  });

  it('disposes a late result after all consumers cancel', async () => {
    let resolve!: (asset: ResidentAsset) => void;
    const dispose = vi.fn();
    const residency = new AssetResidency(() => new Promise(done => { resolve = done; }), 'low');
    const lease = residency.acquire('poster:s03');
    const rejected = expect(lease.ready).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve();
    lease.release();
    resolve({ value: 1, dispose });
    await rejected;
    await new Promise(done => setTimeout(done, 0));
    expect(dispose).toHaveBeenCalledOnce();
    expect(residency.consumers('poster:s03')).toBe(0);
  });

  it('does not start a cancelled request, and can retry failures', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue({ value: 1, dispose() {} });
    const residency = new AssetResidency(load, 'mid');
    const abort = new AbortController();
    abort.abort();
    await expect(residency.acquire('poster:s04', abort.signal).ready).rejects.toMatchObject({ name: 'AbortError' });
    expect(load).not.toHaveBeenCalled();
    const failed = residency.acquire('poster:s04');
    await expect(failed.ready).rejects.toThrow('network');
    failed.release();
    const retry = residency.acquire('poster:s04');
    await expect(retry.ready).resolves.toMatchObject({ value: 1 });
    retry.release();
    residency.evictUnused();
  });

  it('loads a cold-seek destination before neighbors and releases the whole session', async () => {
    const order: AssetKey[] = [];
    const dispose = vi.fn();
    const residency = new AssetResidency(async key => { order.push(key); return { value: key, dispose }; }, 'high');
    const abort = new AbortController();
    const session = acquireDestination(residency, 's05', abort.signal);
    expect(order).toEqual([]);
    await session.ready;
    await new Promise(done => setTimeout(done, 0));
    expect(order).toEqual(['gallery.shell', 'gallery.portal', 'poster:s05', 'world.rif-aljouf', 'world.loryfy']);
    residency.evictUnused();
    expect(dispose).not.toHaveBeenCalled();
    abort.abort();
    session.release();
    residency.evictUnused();
    expect(dispose).toHaveBeenCalledTimes(5);
  });

  it('does not prefetch neighbors when a destination is cancelled', async () => {
    let resolve!: (asset: ResidentAsset) => void;
    const load = vi.fn(() => new Promise<ResidentAsset>(done => { resolve = done; }));
    const residency = new AssetResidency(load, 'mid');
    const abort = new AbortController();
    const session = acquireDestination(residency, 's05', abort.signal);
    const rejection = expect(session.ready).rejects.toMatchObject({ name: 'AbortError' });
    await Promise.resolve();
    abort.abort();
    resolve({ value: 1, dispose() {} });
    await rejection;
    expect(load).toHaveBeenCalledTimes(4);
    session.release();
  });
});
