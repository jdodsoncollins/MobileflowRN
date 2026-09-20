import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  generatePKCEPair,
  generateState,
  s256Challenge,
} from '../src/support/oauthSecurity';

const URL_SAFE = /^[A-Za-z0-9\-._~]+$/;

describe('OAuthSecurity', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.doUnmock('expo-crypto');
  });

  it('state is URL-safe and unique', () => {
    const a = generateState();
    const b = generateState();
    expect(a).toHaveLength(32);
    expect(b).toHaveLength(32);
    expect(a).not.toBe(b);
    expect(a).toMatch(URL_SAFE);
  });

  it('pkce challenge is S256 base64url', async () => {
    const pair = await generatePKCEPair();
    expect(pair.verifier).toHaveLength(64);
    expect(pair.challenge.length).toBeGreaterThan(0);
    expect(pair.challenge).not.toContain('+');
    expect(pair.challenge).not.toContain('/');
    expect(pair.challenge).not.toContain('=');
    expect(pair.challenge).toBe(await s256Challenge(pair.verifier));
  });

  it('fails closed when secure randomness is unavailable', async () => {
    vi.resetModules();
    vi.doMock('expo-crypto', () => ({
      getRandomValues: undefined,
      digest: undefined,
      CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    }));
    vi.stubGlobal('crypto', undefined);
    const mod = await import('../src/support/oauthSecurity');
    expect(() => mod.generateState()).toThrow('secure randomness');
  });
});
