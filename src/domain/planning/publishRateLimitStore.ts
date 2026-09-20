import type { SiteID } from '../models/ids';
import type { KeyValueStore } from '../../services/storage/kvStore';
import { MemoryKeyValueStore } from '../../services/storage/memoryKvStore';

/**
 * Tracks Webflow publish cooldowns per site.
 * Combines client-side 60s cooldown after success + server Retry-After from 429.
 */
export class PublishRateLimitStore {
  static readonly defaultCooldownSeconds = 60;
  static readonly defaultKey = 'mobileflow.publishNextAllowedBySite';

  private nextAllowedBySiteID: Record<string, number> = {};
  private readonly storage: KeyValueStore;
  private readonly storageKey: string;

  constructor(
    storage: KeyValueStore = new MemoryKeyValueStore(),
    storageKey: string = PublishRateLimitStore.defaultKey,
  ) {
    this.storage = storage;
    this.storageKey = storageKey;
  }

  async hydrate(): Promise<void> {
    const raw = await this.storage.getItem(this.storageKey);
    if (!raw) {
      this.nextAllowedBySiteID = {};
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, number>;
      const now = Date.now();
      const result: Record<string, number> = {};
      for (const [id, ts] of Object.entries(parsed)) {
        if (typeof ts === 'number' && ts > now) {
          result[id] = ts;
        }
      }
      this.nextAllowedBySiteID = result;
    } catch {
      this.nextAllowedBySiteID = {};
    }
  }

  nextAllowed(siteID: SiteID, now = Date.now()): Date | null {
    const ts = this.nextAllowedBySiteID[siteID];
    if (ts == null) return null;
    if (ts <= now) {
      delete this.nextAllowedBySiteID[siteID];
      void this.persist();
      return null;
    }
    return new Date(ts);
  }

  isInCooldown(siteID: SiteID, now = Date.now()): boolean {
    const ts = this.nextAllowedBySiteID[siteID];
    return ts != null && ts > now;
  }

  remainingSeconds(siteID: SiteID, now = Date.now()): number | null {
    const ts = this.nextAllowedBySiteID[siteID];
    if (ts == null || ts <= now) return null;
    return Math.max(1, Math.ceil((ts - now) / 1000));
  }

  async recordSuccess(
    siteID: SiteID,
    at = Date.now(),
    cooldownSeconds = PublishRateLimitStore.defaultCooldownSeconds,
  ): Promise<void> {
    await this.setNextAllowed(at + cooldownSeconds * 1000, siteID);
  }

  async recordRateLimited(
    siteID: SiteID,
    retryAfterSeconds: number | null,
    at = Date.now(),
  ): Promise<void> {
    const wait = Math.max(
      retryAfterSeconds ?? PublishRateLimitStore.defaultCooldownSeconds,
      1,
    );
    await this.setNextAllowed(at + wait * 1000, siteID);
  }

  async clear(siteID: SiteID): Promise<void> {
    delete this.nextAllowedBySiteID[siteID];
    await this.persist();
  }

  async clearAll(): Promise<void> {
    this.nextAllowedBySiteID = {};
    await this.storage.removeItem(this.storageKey);
  }

  private async setNextAllowed(ts: number, siteID: SiteID): Promise<void> {
    const key = siteID as string;
    const existing = this.nextAllowedBySiteID[key];
    this.nextAllowedBySiteID[key] =
      existing != null ? Math.max(existing, ts) : ts;
    await this.persist();
  }

  private async persist(): Promise<void> {
    await this.storage.setItem(
      this.storageKey,
      JSON.stringify(this.nextAllowedBySiteID),
    );
  }
}
