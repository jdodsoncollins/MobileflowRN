import { describe, expect, it, vi } from 'vitest';
import {
  decodeTokenExchangeResponse,
  WebflowAuthService,
} from '../src/services/auth/webflowAuthService';
import { MemoryTokenStore, TokenStoreKeys } from '../src/services/auth/tokenStore';
import type { WebflowOAuthConfig } from '../src/services/auth/webflowOAuthConfig';
import { WebflowScopes } from '../src/services/auth/endpoints';
import { AuthError } from '../src/services/auth/authErrors';

const testOAuthConfig: WebflowOAuthConfig = {
  clientID: 'test-webflow-client-id',
  redirectURI: 'https://example.com/mobileflow-callback',
  scopes: WebflowScopes.mobileflowMVP,
  tokenExchangeURL: 'https://example.com/mobileflow-token',
  tokenRefreshURL: null,
  debugClientSecret: null,
};

describe('token exchange decode', () => {
  it('decodes access + refresh + expires_in', () => {
    const sample = JSON.stringify({
      access_token: 'abc123',
      refresh_token: 'ref456',
      expires_in: 7200,
    });
    const token = decodeTokenExchangeResponse(sample);
    expect(token.accessToken).toBe('abc123');
    expect(token.refreshToken).toBe('ref456');
    expect(token.expiresAt).toBeTruthy();
  });
});

describe('WebflowAuthService', () => {
  it('inits with bundled config and no stored credentials', async () => {
    const service = new WebflowAuthService({
      store: new MemoryTokenStore(),
      config: testOAuthConfig,
      openAuthSession: async () => null,
    });
    await service.hydrate();
    expect(service.hasStoredCredentials).toBe(false);
    expect(await service.isConnected()).toBe(false);
  });

  it('connect exchanges code via proxy and persists token', async () => {
    const store = new MemoryTokenStore();
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          access_token: 'live_token',
          refresh_token: 'live_refresh',
          expires_in: 3600,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    const service = new WebflowAuthService({
      store,
      config: testOAuthConfig,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      openAuthSession: async () => {
        const state = await store.load(TokenStoreKeys.oauthPendingState);
        return `mobileflow://oauth/callback?code=auth_code&state=${state}`;
      },
    });

    await service.connect();
    expect(await service.isConnected()).toBe(true);
    expect(await service.accessToken()).toBe('live_token');
    expect(await store.load(TokenStoreKeys.accessToken)).toBe('live_token');
    expect(await store.load(TokenStoreKeys.refreshToken)).toBeNull();
    expect(fetchImpl).toHaveBeenCalled();
    const call = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const init = call[1];
    const body = JSON.parse(String(init.body)) as Record<string, string>;
    expect(body.grant_type).toBe('authorization_code');
    expect(body.code).toBe('auth_code');
    expect(body.code_verifier).toBeTruthy();
    expect(body.client_id).toBe(testOAuthConfig.clientID);
    // Client secret must never be sent from the app
    expect(body.client_secret).toBeUndefined();
  });

  it('rejects state mismatch', async () => {
    const store = new MemoryTokenStore();
    const service = new WebflowAuthService({
      store,
      config: testOAuthConfig,
      openAuthSession: async () =>
        'mobileflow://oauth/callback?code=x&state=wrong',
    });
    await expect(service.connect()).rejects.toMatchObject({
      kind: 'stateMismatch',
    } satisfies Partial<AuthError>);
  });

  it('rejects callbacks from other routes and callbacks with fragments', async () => {
    for (const callback of [
      'mobileflow://evil/callback?code=x&state=',
      'mobileflow://oauth/callback?code=x&state=#fragment',
      'https://example.com/other?code=x&state=',
    ]) {
      const store = new MemoryTokenStore();
      const service = new WebflowAuthService({
        store,
        config: testOAuthConfig,
        openAuthSession: async () =>
          `${callback}${await store.load(TokenStoreKeys.oauthPendingState)}`,
      });
      await expect(service.connect()).rejects.toMatchObject({ kind: 'stateMismatch' });
    }

    const store = new MemoryTokenStore();
    const service = new WebflowAuthService({
      store,
      config: testOAuthConfig,
      openAuthSession: async () => {
        const state = await store.load(TokenStoreKeys.oauthPendingState);
        return `${testOAuthConfig.redirectURI}?code=x&state=${state}#access_token=leak`;
      },
    });
    await expect(service.connect()).rejects.toMatchObject({ kind: 'stateMismatch' });
  });

  it('accepts www host for the HTTPS callback path', async () => {
    const store = new MemoryTokenStore();
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          access_token: 'www_token',
          expires_in: 3600,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    const service = new WebflowAuthService({
      store,
      config: testOAuthConfig,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      openAuthSession: async () => {
        const state = await store.load(TokenStoreKeys.oauthPendingState);
        return `https://www.example.com/mobileflow-callback?code=auth_code&state=${state}`;
      },
    });
    await service.connect();
    expect(await service.accessToken()).toBe('www_token');
  });

  it('disconnect clears credentials', async () => {
    const store = new MemoryTokenStore();
    const service = new WebflowAuthService({
      store,
      config: testOAuthConfig,
      fetchImpl: (async () =>
        new Response(
          JSON.stringify({ access_token: 't', expires_in: 3600 }),
          { status: 200 },
        )) as unknown as typeof fetch,
      openAuthSession: async () => {
        const state = await store.load(TokenStoreKeys.oauthPendingState);
        return `mobileflow://oauth/callback?code=c&state=${state}`;
      },
    });
    await service.connect();
    await service.disconnect();
    expect(await service.isConnected()).toBe(false);
    expect(await store.load(TokenStoreKeys.accessToken)).toBeNull();
  });

  it('attempts every credential deletion and reports aggregate failure', async () => {
    const store = new MemoryTokenStore();
    const deleted: string[] = [];
    const originalDelete = store.delete.bind(store);
    store.delete = vi.fn(async (key: string) => {
      deleted.push(key);
      if (key === TokenStoreKeys.accessToken) throw new Error('keychain locked');
      await originalDelete(key);
    });
    const service = new WebflowAuthService({
      store,
      config: testOAuthConfig,
      openAuthSession: async () => null,
    });

    await expect(service.disconnect()).rejects.toThrow(/1 of 5/);
    expect(deleted).toEqual(expect.arrayContaining([
      TokenStoreKeys.accessToken,
      TokenStoreKeys.refreshToken,
      TokenStoreKeys.tokenExpiry,
      TokenStoreKeys.oauthPendingState,
      TokenStoreKeys.oauthCodeVerifier,
    ]));
  });

  it('never injects fixture sites — sites come only from API caller', () => {
    // Auth service has no site list; connection sites must come from listSites().
    const service = new WebflowAuthService({
      store: new MemoryTokenStore(),
      config: testOAuthConfig,
      openAuthSession: async () => null,
    });
    expect(service.getToken()).toBeNull();
  });

  it('serializes refresh requests when the proxy declares refresh support', async () => {
    const store = new MemoryTokenStore();
    await store.save(TokenStoreKeys.accessToken, 'expired');
    await store.save(TokenStoreKeys.refreshToken, 'refresh-token');
    await store.save(TokenStoreKeys.tokenExpiry, '1');
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          access_token: 'renewed',
          refresh_token: 'rotated',
          expires_in: 3600,
        }),
        { status: 200 },
      ),
    );
    const service = new WebflowAuthService({
      store,
      config: {
        ...testOAuthConfig,
        tokenRefreshURL: 'https://proxy.example/token',
      },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const [first, second] = await Promise.all([
      service.accessToken(),
      service.accessToken(),
    ]);

    expect(first).toBe('renewed');
    expect(second).toBe('renewed');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const body = JSON.parse(
      String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body),
    ) as Record<string, string>;
    expect(body).toEqual({
      grant_type: 'refresh_token',
      refresh_token: 'refresh-token',
      client_id: testOAuthConfig.clientID,
    });
    expect(await store.load(TokenStoreKeys.refreshToken)).toBe('rotated');
  });

  it('does not restore credentials when disconnected during code exchange', async () => {
    const store = new MemoryTokenStore();
    let resolveFetch!: (response: Response) => void;
    const fetchImpl = vi.fn(
      () => new Promise<Response>((resolve) => { resolveFetch = resolve; }),
    );
    const service = new WebflowAuthService({
      store,
      config: testOAuthConfig,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      openAuthSession: async () => {
        const state = await store.load(TokenStoreKeys.oauthPendingState);
        return `mobileflow://oauth/callback?code=c&state=${state}`;
      },
    });

    const connecting = service.connect();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    await service.disconnect();
    resolveFetch(new Response(JSON.stringify({ access_token: 'late' }), { status: 200 }));
    await expect(connecting).rejects.toBeDefined();
    expect(service.getToken()).toBeNull();
    expect(await store.load(TokenStoreKeys.accessToken)).toBeNull();
  });

  it('does not restore credentials when disconnected during refresh', async () => {
    const store = new MemoryTokenStore();
    await store.save(TokenStoreKeys.accessToken, 'expired');
    await store.save(TokenStoreKeys.refreshToken, 'refresh-token');
    await store.save(TokenStoreKeys.tokenExpiry, '1');
    let resolveFetch!: (response: Response) => void;
    const fetchImpl = vi.fn(
      () => new Promise<Response>((resolve) => { resolveFetch = resolve; }),
    );
    const service = new WebflowAuthService({
      store,
      config: { ...testOAuthConfig, tokenRefreshURL: 'https://proxy.example/token' },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const refreshing = service.accessToken();
    await vi.waitFor(() => expect(fetchImpl).toHaveBeenCalled());
    await service.disconnect();
    resolveFetch(new Response(JSON.stringify({ access_token: 'late' }), { status: 200 }));
    await expect(refreshing).rejects.toBeDefined();
    expect(service.getToken()).toBeNull();
    expect(await store.load(TokenStoreKeys.accessToken)).toBeNull();
  });

  it('does not expose a raw token proxy error body', async () => {
    const store = new MemoryTokenStore();
    const service = new WebflowAuthService({
      store,
      config: testOAuthConfig,
      fetchImpl: (async () =>
        new Response('secret upstream stack trace', { status: 502 })) as typeof fetch,
      openAuthSession: async () => {
        const state = await store.load(TokenStoreKeys.oauthPendingState);
        return `mobileflow://oauth/callback?code=c&state=${state}`;
      },
    });

    const error = await service.connect().catch((caught: unknown) => caught);
    expect(error).not.toMatchObject({ message: expect.stringMatching(/secret upstream/) });
    expect(error).toMatchObject({
      kind: 'tokenExchangeFailed',
    });
  });
});
