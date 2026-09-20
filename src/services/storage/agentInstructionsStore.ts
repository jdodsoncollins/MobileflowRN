import type { SiteID } from '../../domain/models/ids';
import type { KeyValueStore } from './kvStore';
import { MemoryKeyValueStore } from './memoryKvStore';

/** Per-site agent instructions (device-local; not Webflow API yet). */
export class AgentInstructionsStore {
  static readonly keyPrefix = 'mobileflow.agentInstructions.';

  constructor(private readonly storage: KeyValueStore = new MemoryKeyValueStore()) {}

  private key(siteID: SiteID): string {
    return `${AgentInstructionsStore.keyPrefix}${siteID}`;
  }

  async load(siteID: SiteID): Promise<string | null> {
    return this.storage.getItem(this.key(siteID));
  }

  async save(siteID: SiteID, text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) {
      await this.storage.removeItem(this.key(siteID));
      return;
    }
    await this.storage.setItem(this.key(siteID), trimmed);
  }

  async clear(siteID: SiteID): Promise<void> {
    await this.storage.removeItem(this.key(siteID));
  }

  async clearAll(): Promise<void> {
    await this.storage.removeItemsWithPrefix(AgentInstructionsStore.keyPrefix);
  }
}
