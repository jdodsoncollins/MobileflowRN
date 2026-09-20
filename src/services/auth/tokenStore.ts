import type { WebflowToken } from './endpoints';

export const TokenStoreKeys = {
  accessToken: 'com.jcollins.mobileflow.accessToken',
  refreshToken: 'com.jcollins.mobileflow.refreshToken',
  tokenExpiry: 'com.jcollins.mobileflow.tokenExpiry',
  oauthPendingState: 'com.jcollins.mobileflow.oauthPendingState',
  oauthCodeVerifier: 'com.jcollins.mobileflow.oauthCodeVerifier',
  selectedSiteID: 'com.jcollins.mobileflow.selectedSiteID',
} as const;

/** Secure credential storage (Keychain / SecureStore / in-memory for tests). */
export interface TokenStore {
  save(key: string, value: string): Promise<void>;
  load(key: string): Promise<string | null>;
  delete(key: string): Promise<void>;
}

export class MemoryTokenStore implements TokenStore {
  private readonly map = new Map<string, string>();

  async save(key: string, value: string): Promise<void> {
    this.map.set(key, value);
  }

  async load(key: string): Promise<string | null> {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
  }
}

export async function persistToken(
  store: TokenStore,
  token: WebflowToken,
): Promise<void> {
  await store.save(TokenStoreKeys.accessToken, token.accessToken);
  if (token.refreshToken) {
    await store.save(TokenStoreKeys.refreshToken, token.refreshToken);
  } else {
    await store.delete(TokenStoreKeys.refreshToken);
  }
  if (token.expiresAt) {
    const ts = String(new Date(token.expiresAt).getTime() / 1000);
    await store.save(TokenStoreKeys.tokenExpiry, ts);
  } else {
    await store.delete(TokenStoreKeys.tokenExpiry);
  }
}

export async function loadStoredToken(
  store: TokenStore,
): Promise<WebflowToken | null> {
  const access = await store.load(TokenStoreKeys.accessToken);
  if (!access) return null;

  // Reject legacy mock tokens if present
  if (access.startsWith('mock_')) {
    await store.delete(TokenStoreKeys.accessToken);
    await store.delete(TokenStoreKeys.refreshToken);
    await store.delete(TokenStoreKeys.tokenExpiry);
    return null;
  }

  const refresh = await store.load(TokenStoreKeys.refreshToken);
  const expiryRaw = await store.load(TokenStoreKeys.tokenExpiry);
  const expiresAt =
    expiryRaw != null && expiryRaw !== ''
      ? new Date(Number(expiryRaw) * 1000).toISOString()
      : null;

  return {
    accessToken: access,
    refreshToken: refresh,
    expiresAt,
  };
}

export async function clearStoredToken(store: TokenStore): Promise<void> {
  const keys = [
    TokenStoreKeys.accessToken,
    TokenStoreKeys.refreshToken,
    TokenStoreKeys.tokenExpiry,
    TokenStoreKeys.oauthPendingState,
    TokenStoreKeys.oauthCodeVerifier,
  ];
  const results = await Promise.allSettled(keys.map((key) => store.delete(key)));
  const failures = results.filter(
    (result): result is PromiseRejectedResult => result.status === 'rejected',
  );
  if (failures.length > 0) {
    throw new AggregateError(
      failures.map((failure) => failure.reason),
      `Could not delete ${failures.length} of ${keys.length} stored credential values.`,
    );
  }
}
