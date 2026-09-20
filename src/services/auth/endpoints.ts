/** Public Webflow integration endpoints. Token exchange is configured via env. */
export const WebflowEndpoints = {
  dataAPIBase: 'https://api.webflow.com/v2',
  mcpServer: 'https://mcp.webflow.com/mcp',
  mcpBetaServer: 'https://mcp.webflow.com/beta/mcp',
  oauthAuthorize: 'https://webflow.com/oauth/authorize',
  oauthToken: 'https://api.webflow.com/oauth/access_token',
} as const;

export const WebflowScopes = {
  mobileflowMVP: [
    'sites:read',
    'sites:write',
    'pages:read',
    'pages:write',
    'cms:read',
    'cms:write',
    'components:read',
    'components:write',
    'assets:read',
    'assets:write',
    'forms:read',
    'forms:write',
    'comments:read',
    'comments:write',
    'authorized_user:read',
    'branches:read',
  ] as const,

  get joined(): string {
    return this.mobileflowMVP.join(' ');
  },
};

export interface WebflowToken {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
}

export function tokenIsExpired(token: WebflowToken, now = Date.now()): boolean {
  if (!token.expiresAt) return false;
  return new Date(token.expiresAt).getTime() <= now;
}
