import { describe, expect, it } from 'vitest';
import { AgentInstructionsStore } from '../src/services/storage/agentInstructionsStore';
import { MemoryKeyValueStore } from '../src/services/storage/memoryKvStore';
import { siteID } from '../src/domain/models/ids';

describe('AgentInstructionsStore', () => {
  it('saves and loads per site', async () => {
    const store = new AgentInstructionsStore(new MemoryKeyValueStore());
    const a = siteID('site_a');
    const b = siteID('site_b');
    await store.save(a, '  Prefer short titles  ');
    await store.save(b, 'Use brand X');
    expect(await store.load(a)).toBe('Prefer short titles');
    expect(await store.load(b)).toBe('Use brand X');
  });

  it('clear and empty save remove key', async () => {
    const store = new AgentInstructionsStore(new MemoryKeyValueStore());
    const s = siteID('site_1');
    await store.save(s, 'hello');
    await store.save(s, '   ');
    expect(await store.load(s)).toBeNull();
    await store.save(s, 'again');
    await store.clear(s);
    expect(await store.load(s)).toBeNull();
  });

  it('clearAll removes instructions for every site', async () => {
    const store = new AgentInstructionsStore(new MemoryKeyValueStore());
    const a = siteID('site_a');
    const b = siteID('site_b');
    await store.save(a, 'First');
    await store.save(b, 'Second');

    await store.clearAll();

    expect(await store.load(a)).toBeNull();
    expect(await store.load(b)).toBeNull();
  });
});
