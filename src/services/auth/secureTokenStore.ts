import * as SecureStore from 'expo-secure-store';
import { MemoryTokenStore, type TokenStore } from './tokenStore';
import { Platform } from 'react-native';

/**
 * SecureStore on iOS/Android; in-memory on web (dev smoke only — not product storage).
 * Never use memory store for production native builds.
 */
export function createPlatformTokenStore(): TokenStore {
  if (Platform.OS === 'web') {
    return new MemoryTokenStore();
  }
  return {
    async save(key: string, value: string): Promise<void> {
      await SecureStore.setItemAsync(key, value);
    },
    async load(key: string): Promise<string | null> {
      return SecureStore.getItemAsync(key);
    },
    async delete(key: string): Promise<void> {
      await SecureStore.deleteItemAsync(key);
    },
  };
}
