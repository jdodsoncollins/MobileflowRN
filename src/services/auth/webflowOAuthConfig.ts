import { WebflowScopes } from './endpoints';

export interface WebflowOAuthConfig {
  clientID: string;
  /** Exact Redirect URI registered in the Webflow app dashboard. */
  redirectURI: string;
  scopes: readonly string[];
  /** HTTPS endpoint that completes token exchange with the client secret server-side. */
  tokenExchangeURL: string | null;
  /** Proxy endpoint that explicitly accepts grant_type=refresh_token. */
  tokenRefreshURL?: string | null;
  /** Debug-only. Never set for production builds. */
  debugClientSecret: string | null;
}

export const OAUTH_CALLBACK_SCHEME = 'mobileflow';
export const OAUTH_APP_CALLBACK_URI = 'mobileflow://oauth/callback';
export const PLACEHOLDER_CLIENT_ID = 'YOUR_WEBFLOW_CLIENT_ID';

function env(name: string): string {
  if (typeof process === 'undefined') return '';
  return process.env[name]?.trim() ?? '';
}

function extraOAuth(): {
  clientID?: string;
  redirectURI?: string;
  tokenProxyURL?: string;
} {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Constants = require('expo-constants').default as {
      expoConfig?: {
        extra?: {
          webflowClientId?: string;
          oauthRedirectUri?: string;
          tokenProxyUrl?: string;
        };
      };
    };
    const extra = Constants.expoConfig?.extra ?? {};
    return {
      clientID: extra.webflowClientId?.trim(),
      redirectURI: extra.oauthRedirectUri?.trim(),
      tokenProxyURL: extra.tokenProxyUrl?.trim(),
    };
  } catch {
    return {};
  }
}

export function resolveOAuthConfig(): WebflowOAuthConfig {
  const extra = extraOAuth();
  const clientID =
    env('EXPO_PUBLIC_WEBFLOW_CLIENT_ID') ||
    extra.clientID ||
    PLACEHOLDER_CLIENT_ID;
  const redirectURI =
    env('EXPO_PUBLIC_OAUTH_REDIRECT_URI') ||
    extra.redirectURI ||
    OAUTH_APP_CALLBACK_URI;
  const tokenExchangeURL =
    env('EXPO_PUBLIC_TOKEN_PROXY_URL') || extra.tokenProxyURL || null;

  return {
    clientID,
    redirectURI,
    scopes: WebflowScopes.mobileflowMVP,
    tokenExchangeURL,
    tokenRefreshURL: null,
    debugClientSecret: null,
  };
}

/** Public client ID + proxy token exchange. Secrets never ship in the app. */
export const bundledOAuthConfig: WebflowOAuthConfig = resolveOAuthConfig();

export const placeholderOAuthConfig: WebflowOAuthConfig = {
  clientID: PLACEHOLDER_CLIENT_ID,
  redirectURI: OAUTH_APP_CALLBACK_URI,
  scopes: WebflowScopes.mobileflowMVP,
  tokenExchangeURL: null,
  tokenRefreshURL: null,
  debugClientSecret: null,
};

export function isPlaceholderOAuthConfig(config: WebflowOAuthConfig): boolean {
  return (
    !config.clientID ||
    config.clientID === PLACEHOLDER_CLIENT_ID ||
    !config.tokenExchangeURL
  );
}
