import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KeyValueStore } from './kvStore';

/**
 * Device-local durable store (AsyncStorage).
 * Use for Activity, rate limits, site selection, agent instructions.
 * Tokens stay on SecureStore / platform token store.
 */
export class AsyncStorageKeyValueStore implements KeyValueStore {
  async getItem(key: string): Promise<string | null> {
    return AsyncStorage.getItem(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(key, value);
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }

  async removeItemsWithPrefix(prefix: string): Promise<void> {
    const keys = await AsyncStorage.getAllKeys();
    const matching = keys.filter((key) => key.startsWith(prefix));
    if (matching.length > 0) await AsyncStorage.multiRemove(matching);
  }
}

/** Production app storage — durable across relaunch. */
export function createAppKeyValueStore(): KeyValueStore {
  return new AsyncStorageKeyValueStore();
}
