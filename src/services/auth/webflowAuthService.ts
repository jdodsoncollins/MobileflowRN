import {
  generatePKCEPair,
  generateState,
} from '../../support/oauthSecurity';
import { AuthError } from './authErrors';
import {
  WebflowEndpoints,
  tokenIsExpired,
  type WebflowToken,
} from './endpoints';
import {
  clearStoredToken,
  loadStoredToken,
  persistToken,
  TokenStoreKeys,
  type TokenStore,
} from './tokenStore';
import {
  isPlaceholderOAuthConfig,
  OAUTH_APP_CALLBACK_URI,
  OAUTH_CALLBACK_SCHEME,
  type WebflowOAuthConfig,
} from './webflowOAuthConfig';

export interface AuthService {
  readonly hasStoredCredentials: boolean;
  isConnected(): Promise<boolean>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  accessToken(): Promise<string | null>;
  /** Current in-memory token if any (for diagnostics). */
  getToken(): WebflowToken | null;
}

/** Opens authorize URL and returns the callback URL (or null if cancelled). */
export type AuthSessionOpener = (args: {
  authorizeURL: string;
  callbackScheme: string;
}) => Promise<string | null>;

export interface WebflowAuthServiceOptions {
  store: TokenStore;
  config: WebflowOAuthConfig;
  openAuthSession?: AuthSessionOpener;
  fetchImpl?: typeof fetch;
}

/**
 * OAuth-backed auth. Token exchange uses the server proxy so the client secret
 * never ships in the app binary.
 */
export class WebflowAuthService implements AuthService {
  private readonly store: TokenStore;
  private readonly config: WebflowOAuthConfig;
  private readonly openAuthSession: AuthSessionOpener;
  private readonly fetchImpl: typeof fetch;
  private token: WebflowToken | null = null;
  private hydrated = false;
  private refreshPromise: Promise<string> | null = null;
  private generation = 0;
  private inFlight = new Set<AbortController>();
  private credentialMutation: Promise<void> = Promise.resolve();

  constructor(opts: WebflowAuthServiceOptions) {
    this.store = opts.store;
    this.config = opts.config;
    this.openAuthSession =
      opts.openAuthSession ??
      (async () => {
        throw AuthError.invalidConfiguration();
      });
    this.fetchImpl = opts.fetchImpl ?? fetch.bind(globalThis);
  }

  get hasStoredCredentials(): boolean {
    return (
      this.token != null &&
      (!tokenIsExpired(this.token) ||
        (!!this.token.refreshToken && !!this.config.tokenRefreshURL))
    );
  }

  getToken(): WebflowToken | null {
    return this.token;
  }

  async hydrate(): Promise<void> {
    if (this.hydrated) return;
    const generation = this.generation;
    const token = await loadStoredToken(this.store);
    if (generation !== this.generation) return;
    this.token = token;
    this.hydrated = true;
  }

  async isConnected(): Promise<boolean> {
    await this.hydrate();
    if (!this.token) return false;
    if (!tokenIsExpired(this.token)) return true;
    if (!this.token.refreshToken || !this.config.tokenRefreshURL) return false;
    try {
      await this.refreshAccessToken();
      return true;
    } catch {
      return false;
    }
  }

  async connect(): Promise<void> {
    const generation = ++this.generation;
    await this.hydrate();
    if (
      isPlaceholderOAuthConfig(this.config) ||
      !isHTTPSURL(this.config.tokenExchangeURL)
    ) {
      throw AuthError.invalidConfiguration();
    }

    const pkce = await generatePKCEPair();
    const state = generateState();
    await this.store.save(TokenStoreKeys.oauthPendingState, state);
    await this.store.save(TokenStoreKeys.oauthCodeVerifier, pkce.verifier);

    try {
      const authorizeURL = this.buildAuthorizeURL(state, pkce.challenge);
      const callbackURL = await this.openAuthSession({
        authorizeURL,
        callbackScheme: OAUTH_CALLBACK_SCHEME,
      });
      if (!callbackURL) throw AuthError.cancelled();
      this.assertCurrent(generation);
      await this.handleOAuthCallback(callbackURL, generation);
    } finally {
      await this.clearPendingOAuthFlow();
    }
  }

  async disconnect(): Promise<void> {
    ++this.generation;
    for (const controller of this.inFlight) controller.abort();
    this.inFlight.clear();
    this.refreshPromise = null;
    this.token = null;
    this.hydrated = true;
    await this.mutateCredentials(() => clearStoredToken(this.store));
  }

  async accessToken(): Promise<string | null> {
    await this.hydrate();
    if (!this.token) throw AuthError.notConnected();
    if (tokenIsExpired(this.token)) return this.refreshAccessToken();
    return this.token.accessToken;
  }

  /** Test / deep-link helper: complete flow from a callback URL after PKCE was stored. */
  async completeFromCallbackURL(callbackURL: string): Promise<void> {
    const generation = this.generation;
    try {
      await this.handleOAuthCallback(callbackURL, generation);
    } finally {
      await this.clearPendingOAuthFlow();
    }
  }

  private buildAuthorizeURL(state: string, codeChallenge: string): string {
    const url = new URL(WebflowEndpoints.oauthAuthorize);
    url.searchParams.set('client_id', this.config.clientID);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', this.config.redirectURI);
    url.searchParams.set('scope', this.config.scopes.join(' '));
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }

  private async handleOAuthCallback(
    callbackURL: string,
    generation: number,
  ): Promise<void> {
    const params = extractCallbackQueryParams(
      callbackURL,
      this.config.redirectURI,
    );
    if (params.error) {
      throw AuthError.oauthError('Authorization request was rejected');
    }
    const returnedState = params.state;
    const expectedState = await this.store.load(TokenStoreKeys.oauthPendingState);
    if (!returnedState || !expectedState || returnedState !== expectedState) {
      throw AuthError.stateMismatch();
    }
    const code = params.code;
    if (!code) throw AuthError.cancelled();
    const codeVerifier = await this.store.load(TokenStoreKeys.oauthCodeVerifier);
    if (!codeVerifier) throw AuthError.invalidConfiguration();
    this.assertCurrent(generation);
    await this.exchangeCode(code, codeVerifier, generation);
  }

  private async exchangeCode(
    code: string,
    codeVerifier: string,
    generation: number,
  ): Promise<void> {
    if (!this.config.tokenExchangeURL) {
      throw AuthError.invalidConfiguration();
    }
    await this.exchangeViaProxy(
      this.config.tokenExchangeURL,
      code,
      codeVerifier,
      generation,
    );
  }

  private async exchangeViaProxy(
    proxyURL: string,
    code: string,
    codeVerifier: string,
    generation: number,
  ): Promise<void> {
    const controller = this.beginRequest(generation);
    let res: Response;
    try {
      res = await this.fetchImpl(proxyURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.config.redirectURI,
          client_id: this.config.clientID,
          code_verifier: codeVerifier,
        }),
        signal: controller.signal,
      });
    } finally {
      this.inFlight.delete(controller);
    }
    const text = await res.text();
    if (!res.ok) {
      throw this.tokenHTTPError(res.status, 'exchange');
    }
    this.assertCurrent(generation);
    this.applyTokenResponse(text, null);
    await this.persistCurrentToken(generation);
  }

  private tokenHTTPError(status: number, context: string): AuthError {
    return AuthError.tokenExchangeFailed(`HTTP ${status} during token ${context}`);
  }

  private applyTokenResponse(
    body: string,
    fallbackRefreshToken: string | null,
  ): void {
    let parsed: {
      access_token: string;
      refresh_token?: string | null;
      expires_in?: number | null;
    };
    try {
      parsed = JSON.parse(body) as typeof parsed;
    } catch {
      throw AuthError.tokenExchangeFailed('Invalid JSON token response');
    }
    if (
      typeof parsed.access_token !== 'string' ||
      parsed.access_token.trim() === ''
    ) {
      throw AuthError.tokenExchangeFailed('Missing access_token');
    }
    if (
      parsed.refresh_token != null &&
      typeof parsed.refresh_token !== 'string'
    ) {
      throw AuthError.tokenExchangeFailed('Invalid refresh_token');
    }
    if (
      parsed.expires_in != null &&
      (!Number.isFinite(parsed.expires_in) || parsed.expires_in <= 0)
    ) {
      throw AuthError.tokenExchangeFailed('Invalid expires_in');
    }
    const expiresAt =
      parsed.expires_in != null
        ? new Date(Date.now() + parsed.expires_in * 1000).toISOString()
        : null;
    this.token = {
      accessToken: parsed.access_token,
      refreshToken: this.config.tokenRefreshURL
        ? (parsed.refresh_token ?? fallbackRefreshToken)
        : null,
      expiresAt,
    };
  }

  private refreshAccessToken(): Promise<string> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.performTokenRefresh().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private async performTokenRefresh(): Promise<string> {
    const generation = this.generation;
    const refreshToken = this.token?.refreshToken;
    const proxyURL = this.config.tokenRefreshURL;
    if (!refreshToken || !proxyURL) throw AuthError.notConnected();
    if (!isHTTPSURL(proxyURL)) throw AuthError.invalidConfiguration();

    const controller = this.beginRequest(generation);
    let res: Response;
    try {
      res = await this.fetchImpl(proxyURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: this.config.clientID,
        }),
        signal: controller.signal,
      });
    } finally {
      this.inFlight.delete(controller);
    }
    const text = await res.text();
    if (!res.ok) {
      if (res.status === 400 || res.status === 401) await this.disconnect();
      throw this.tokenHTTPError(res.status, 'refresh');
    }
    this.assertCurrent(generation);
    this.applyTokenResponse(text, refreshToken);
    if (!this.token) throw AuthError.tokenExchangeFailed('Invalid refresh response');
    await this.persistCurrentToken(generation);
    return this.token.accessToken;
  }

  private async persistCurrentToken(generation: number): Promise<void> {
    this.assertCurrent(generation);
    if (!this.token) throw AuthError.notConnected();
    const token = this.token;
    await this.mutateCredentials(async () => {
      this.assertCurrent(generation);
      await persistToken(this.store, token);
    });
    this.assertCurrent(generation);
  }

  private async mutateCredentials(operation: () => Promise<void>): Promise<void> {
    const result = this.credentialMutation.then(operation, operation);
    this.credentialMutation = result.catch(() => undefined);
    await result;
  }

  private beginRequest(generation: number): AbortController {
    this.assertCurrent(generation);
    const controller = new AbortController();
    this.inFlight.add(controller);
    return controller;
  }

  private assertCurrent(generation: number): void {
    if (generation !== this.generation) throw AuthError.notConnected();
  }

  private async clearPendingOAuthFlow(): Promise<void> {
    const results = await Promise.allSettled([
      this.store.delete(TokenStoreKeys.oauthPendingState),
      this.store.delete(TokenStoreKeys.oauthCodeVerifier),
    ]);
    const failures = results.filter(
      (result): result is PromiseRejectedResult => result.status === 'rejected',
    );
    if (failures.length > 0) {
      throw new AggregateError(
        failures.map((failure) => failure.reason),
        `Could not clear ${failures.length} pending OAuth values.`,
      );
    }
  }
}

function extractCallbackQueryParams(
  urlString: string,
  expectedHTTPSRedirect: string,
): Record<string, string> {
  try {
    const url = new URL(urlString);
    // Ignore fragment-carried tokens (implicit leak surface).
    if (url.hash) return {};
    const expected = new URL(expectedHTTPSRedirect);
    const isExpectedHTTPS =
      url.protocol === 'https:' &&
      url.pathname === expected.pathname &&
      url.username === '' &&
      url.password === '' &&
      // Accept apex and www hosts for the registered callback path.
      (url.hostname === expected.hostname ||
        url.hostname === `www.${expected.hostname}` ||
        `www.${url.hostname}` === expected.hostname);
    const appCallback = new URL(OAUTH_APP_CALLBACK_URI);
    const pathOk =
      url.pathname === appCallback.pathname ||
      url.pathname === `${appCallback.pathname}/` ||
      // Some parsers treat mobileflow://oauth/callback path oddly
      url.pathname === '/callback' ||
      url.pathname === 'callback';
    const isExpectedAppCallback =
      url.protocol === appCallback.protocol &&
      (url.hostname === appCallback.hostname || url.host === appCallback.host) &&
      pathOk &&
      url.port === '' &&
      url.username === '' &&
      url.password === '';
    if (!isExpectedHTTPS && !isExpectedAppCallback) return {};
    const out: Record<string, string> = {};
    url.searchParams.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  } catch {
    return {};
  }
}

/** Parse token JSON (unit-test helper / shared decode). */
export function decodeTokenExchangeResponse(body: string): WebflowToken {
  const parsed = JSON.parse(body) as {
    access_token: string;
    refresh_token?: string | null;
    expires_in?: number | null;
  };
  if (
    typeof parsed.access_token !== 'string' ||
    parsed.access_token.trim() === ''
  ) {
    throw AuthError.tokenExchangeFailed('Missing access_token');
  }
  if (parsed.refresh_token != null && typeof parsed.refresh_token !== 'string') {
    throw AuthError.tokenExchangeFailed('Invalid refresh_token');
  }
  if (
    parsed.expires_in != null &&
    (!Number.isFinite(parsed.expires_in) || parsed.expires_in <= 0)
  ) {
    throw AuthError.tokenExchangeFailed('Invalid expires_in');
  }
  return {
    accessToken: parsed.access_token,
    refreshToken: parsed.refresh_token ?? null,
    expiresAt:
      parsed.expires_in != null
        ? new Date(Date.now() + parsed.expires_in * 1000).toISOString()
        : null,
  };
}

function isHTTPSURL(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      url.username === '' &&
      url.password === ''
    );
  } catch {
    return false;
  }
}
