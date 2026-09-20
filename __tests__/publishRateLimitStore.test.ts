import { describe, expect, it } from 'vitest';
import { PublishRateLimitStore } from '../src/domain/planning/publishRateLimitStore';
import { MemoryKeyValueStore } from '../src/services/storage/memoryKvStore';
import { siteID } from '../src/domain/models/ids';

describe('PublishRateLimitStore', () => {
  it('success starts default cooldown', async () => {
    const store = new PublishRateLimitStore(new MemoryKeyValueStore());
    const site = siteID('site_a');
    const now = Date.now();
    await store.recordSuccess(site, now, 60);
    expect(store.isInCooldown(site, now + 1000)).toBe(true);
    expect(store.remainingSeconds(site, now + 1000)).toBe(59);
    expect(store.isInCooldown(site, now + 61_000)).toBe(false);
  });

  it('rate limited honors Retry-After', async () => {
    const store = new PublishRateLimitStore(new MemoryKeyValueStore());
    const site = siteID('site_b');
    const now = Date.now();
    await store.recordRateLimited(site, 30, now);
    expect(store.remainingSeconds(site, now)).toBe(30);
    expect(store.isInCooldown(site, now + 31_000)).toBe(false);
  });

  it('longer cooldown wins when extended', async () => {
    const store = new PublishRateLimitStore(new MemoryKeyValueStore());
    const site = siteID('site_c');
    const now = Date.now();
    await store.recordSuccess(site, now, 20);
    await store.recordRateLimited(site, 45, now);
    expect(store.remainingSeconds(site, now)).toBe(45);
  });

  it('persists across store instances', async () => {
    const kv = new MemoryKeyValueStore();
    const site = siteID('site_d');
    const now = Date.now();
    const first = new PublishRateLimitStore(kv);
    await first.recordSuccess(site, now, 90);
    const second = new PublishRateLimitStore(kv);
    await second.hydrate();
    expect(second.isInCooldown(site, now + 10_000)).toBe(true);
    const remaining = second.remainingSeconds(site, now + 10_000);
    expect(remaining).not.toBeNull();
    expect(remaining!).toBeGreaterThanOrEqual(79);
    expect(remaining!).toBeLessThanOrEqual(81);
  });
});
