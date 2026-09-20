import { describe, expect, it } from 'vitest';
import {
  ActivityStore,
  redactActivityText,
} from '../src/services/storage/activityStore';
import { MemoryKeyValueStore } from '../src/services/storage/memoryKvStore';
import { cryptoRandomId } from '../src/domain/actions/mobileflowAction';

describe('ActivityStore', () => {
  const item = (id: string, summary = id) => ({
    id,
    timestamp: new Date().toISOString(),
    siteName: 'Site',
    title: id,
    summary,
    source: 'manual' as const,
    risk: 'low' as const,
    status: 'completed' as const,
  });

  it('append persists and trims order newest first', async () => {
    const kv = new MemoryKeyValueStore();
    const store = new ActivityStore(kv);
    let items: Awaited<ReturnType<ActivityStore['load']>> = [];
    for (let i = 0; i < 5; i++) {
      items = await store.append(
        {
          id: cryptoRandomId(),
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
          siteName: 'Site',
          title: `Action ${i}`,
          summary: `Summary ${i}`,
          source: 'manual',
          risk: 'low',
          status: 'completed',
        },
        items,
      );
    }
    expect(items).toHaveLength(5);
    expect(items[0].title).toBe('Action 4');
    const reloaded = await store.load();
    expect(reloaded).toHaveLength(5);
    expect(reloaded[0].title).toBe('Action 4');
  });

  it('clear removes persisted', async () => {
    const kv = new MemoryKeyValueStore();
    const store = new ActivityStore(kv);
    await store.append(
      {
        id: cryptoRandomId(),
        timestamp: new Date().toISOString(),
        siteName: 'Site',
        title: 'One',
        summary: 'x',
        source: 'command',
        risk: 'high',
        status: 'failed',
      },
      [],
    );
    await store.clear();
    expect(await store.load()).toEqual([]);
  });

  it('serializes concurrent appends without losing either item', async () => {
    const store = new ActivityStore(new MemoryKeyValueStore());

    await Promise.all([store.append(item('first')), store.append(item('second'))]);

    expect((await store.load()).map((entry) => entry.id)).toEqual([
      'second',
      'first',
    ]);
  });

  it('serializes updates against persisted state', async () => {
    const store = new ActivityStore(new MemoryKeyValueStore());
    await store.append(item('first'));

    await Promise.all([
      store.update('first', (entry) => ({ ...entry, summary: 'updated' })),
      store.append(item('second')),
    ]);

    const loaded = await store.load();
    expect(loaded.find((entry) => entry.id === 'first')?.summary).toBe(
      'updated',
    );
    expect(loaded.map((entry) => entry.id)).toContain('second');
  });

  it('redacts credentials before persisting action and error text', async () => {
    const store = new ActivityStore(new MemoryKeyValueStore());
    await store.append(
      item(
        'failure',
        'Failed: Authorization: Bearer secret.jwt.value access_token=abc123 https://example.com?code=oauth-code',
      ),
    );

    const [loaded] = await store.load();
    expect(loaded?.summary).not.toContain('abc123');
    expect(loaded?.summary).not.toContain('oauth-code');
    expect(loaded?.summary).not.toContain('secret.jwt.value');
    expect(loaded?.summary).toContain('[REDACTED]');
  });

  it('redacts sensitive query parameters without changing safe text', () => {
    expect(
      redactActivityText('Request failed at /callback?code=secret&state=safe'),
    ).toBe('Request failed at /callback?code=[REDACTED]&state=safe');
  });
});
