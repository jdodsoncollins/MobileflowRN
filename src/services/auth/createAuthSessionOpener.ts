import type { AuthSessionOpener } from './webflowAuthService';
import { OAUTH_APP_CALLBACK_URI, OAUTH_CALLBACK_SCHEME } from './webflowOAuthConfig';

const SESSION_TIMEOUT_MS = 5 * 60 * 1000;

function isAppCallbackURL(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === `${OAUTH_CALLBACK_SCHEME}:` &&
      parsed.hostname === 'oauth' &&
      (parsed.pathname === '/callback' ||
        parsed.pathname === 'callback' ||
        parsed.pathname === '/callback/')
    );
  } catch {
    return url.startsWith(`${OAUTH_CALLBACK_SCHEME}://oauth/callback`);
  }
}

/**
 * Production browser opener using Expo WebBrowser + Linking.
 *
 * Webflow redirects to an HTTPS page which hops to mobileflow://.
 * ASWebAuthenticationSession sometimes fails to settle on that hop alone;
 * racing Linking deep-link events fixes the hang after the user authorizes.
 *
 * Returns the redirect URL string, or null if the user cancelled / timed out.
 *
 * Native modules are required at call time (not module load) so unit tests that
 * never open a session do not need a React Native runtime.
 */
export function createExpoAuthSessionOpener(): AuthSessionOpener {
  return async ({ authorizeURL }) => {
    const Linking = await import('expo-linking');
    const WebBrowser = await import('expo-web-browser');

    WebBrowser.maybeCompleteAuthSession();

    return await new Promise<string | null>((resolve) => {
      let settled = false;

      const finish = (url: string | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        subscription.remove();
        try {
          void WebBrowser.dismissAuthSession();
        } catch {
          // already dismissed / unsupported
        }
        resolve(url);
      };

      const onUrl = (url: string | null | undefined) => {
        if (url && isAppCallbackURL(url)) {
          finish(url);
        }
      };

      const subscription = Linking.addEventListener('url', ({ url }) => {
        onUrl(url);
      });

      void Linking.getInitialURL().then(onUrl);

      const timeout = setTimeout(() => {
        finish(null);
      }, SESSION_TIMEOUT_MS);

      void WebBrowser.openAuthSessionAsync(authorizeURL, OAUTH_APP_CALLBACK_URI, {
        preferEphemeralSession: false,
      })
        .then((result) => {
          if (result.type === 'success' && 'url' in result && result.url) {
            finish(result.url);
            return;
          }
          if (result.type === 'cancel' || result.type === 'dismiss') {
            finish(null);
          }
        })
        .catch(() => {
          finish(null);
        });
    });
  };
}
