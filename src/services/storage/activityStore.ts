import type { ActivityItem } from '../../domain/models/webflowModels';
import type { KeyValueStore } from './kvStore';
import { MemoryKeyValueStore } from './memoryKvStore';

/** Durable device-local activity log (survives relaunch; not synced to Webflow). */
export class ActivityStore {
  static readonly maxItems = 100;
  static readonly defaultKey = 'mobileflow.recentActivity';

  private readonly storage: KeyValueStore;
  private readonly storageKey: string;
  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(
    storage: KeyValueStore = new MemoryKeyValueStore(),
    storageKey: string = ActivityStore.defaultKey,
  ) {
    this.storage = storage;
    this.storageKey = storageKey;
  }

  async load(): Promise<ActivityItem[]> {
    await this.mutationQueue;
    return this.loadStored();
  }

  private async loadStored(): Promise<ActivityItem[]> {
    const raw = await this.storage.getItem(this.storageKey);
    if (!raw) return [];
    let decoded: ActivityItem[];
    try {
      decoded = JSON.parse(raw) as ActivityItem[];
    } catch {
      return [];
    }
    if (!Array.isArray(decoded)) return [];
    const sanitized = sanitizeActivityItems(decoded);
    if (JSON.stringify(decoded) !== JSON.stringify(sanitized)) {
      await this.persist(sanitized);
    }
    return sanitized;
  }

  async save(items: ActivityItem[]): Promise<void> {
    await this.enqueue(() => this.persist(sanitizeActivityItems(items)));
  }

  async append(
    item: ActivityItem,
    _existing?: ActivityItem[],
  ): Promise<ActivityItem[]> {
    return this.enqueue(async () => {
      const existing = await this.loadStored();
      const next = sanitizeActivityItems([item, ...existing]);
      await this.persist(next);
      return next;
    });
  }

  async update(
    itemID: string,
    updateItem: (item: ActivityItem) => ActivityItem,
  ): Promise<ActivityItem[]> {
    return this.enqueue(async () => {
      const existing = await this.loadStored();
      const next = sanitizeActivityItems(
        existing.map((item) => (item.id === itemID ? updateItem(item) : item)),
      );
      await this.persist(next);
      return next;
    });
  }

  async clear(): Promise<void> {
    await this.enqueue(() => this.storage.removeItem(this.storageKey));
  }

  private async persist(items: ActivityItem[]): Promise<void> {
    await this.storage.setItem(this.storageKey, JSON.stringify(items));
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutationQueue.then(operation, operation);
    this.mutationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

const sensitiveValue =
  /\b(access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|api[_-]?key|code[_-]?verifier|authorization)(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi;
const bearerToken = /\bbearer\s+[a-z0-9._~+/=-]+/gi;
const sensitiveQuery =
  /([?&](?:code|access_token|refresh_token|client_secret)=)[^&#\s]*/gi;

export function redactActivityText(value: string): string {
  return value
    .replace(bearerToken, 'Bearer [REDACTED]')
    .replace(sensitiveValue, '$1$2[REDACTED]')
    .replace(sensitiveQuery, '$1[REDACTED]');
}

export function sanitizeActivityItem(item: ActivityItem): ActivityItem {
  return {
    ...item,
    siteName: redactActivityText(item.siteName),
    title: redactActivityText(item.title),
    summary: redactActivityText(item.summary),
    changes: item.changes?.map((change) => ({
      ...change,
      field: redactActivityText(change.field),
      before: redactActivityText(change.before),
      after: redactActivityText(change.after),
    })),
  };
}

export function sanitizeActivityItems(items: ActivityItem[]): ActivityItem[] {
  return items
    .slice(0, ActivityStore.maxItems)
    .map(sanitizeActivityItem);
}
