import { describe, expect, it } from 'vitest';
import {
  isPlaceholderOAuthConfig,
  PLACEHOLDER_CLIENT_ID,
  resolveOAuthConfig,
} from '../src/services/auth/webflowOAuthConfig';

describe('Webflow OAuth config', () => {
  it('treats missing client ID or proxy as a placeholder', () => {
    const config = resolveOAuthConfig();
    expect(config.clientID).toBe(PLACEHOLDER_CLIENT_ID);
    expect(config.tokenExchangeURL).toBeNull();
    expect(isPlaceholderOAuthConfig(config)).toBe(true);
  });

  it('is ready when client ID and HTTPS proxy are set', () => {
    expect(
      isPlaceholderOAuthConfig({
        clientID: 'abc123',
        redirectURI: 'https://example.com/callback',
        scopes: [],
        tokenExchangeURL: 'https://example.com/token',
        debugClientSecret: null,
      }),
    ).toBe(false);
  });
});
