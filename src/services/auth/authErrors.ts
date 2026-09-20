export type AuthErrorKind =
  | 'notConnected'
  | 'cancelled'
  | 'invalidConfiguration'
  | 'encodingFailed'
  | 'stateMismatch'
  | 'oauthError'
  | 'tokenExchangeFailed';

export class AuthError extends Error {
  readonly kind: AuthErrorKind;
  readonly detail?: string;

  constructor(kind: AuthErrorKind, message: string, detail?: string) {
    super(message);
    this.name = 'AuthError';
    this.kind = kind;
    this.detail = detail;
  }

  static notConnected(): AuthError {
    return new AuthError('notConnected', 'Webflow is not connected.');
  }

  static cancelled(): AuthError {
    return new AuthError('cancelled', 'Authorization was cancelled.');
  }

  static invalidConfiguration(): AuthError {
    return new AuthError(
      'invalidConfiguration',
      'OAuth configuration is invalid. Check Client ID, redirect URI, and that the token-exchange proxy is deployed.',
    );
  }

  static encodingFailed(): AuthError {
    return new AuthError(
      'encodingFailed',
      'Could not encode credentials for secure storage.',
    );
  }

  static stateMismatch(): AuthError {
    return new AuthError(
      'stateMismatch',
      'OAuth state did not match. Try connecting again.',
    );
  }

  static oauthError(desc: string): AuthError {
    return new AuthError(
      'oauthError',
      `OAuth error from Webflow: ${desc}`,
      desc,
    );
  }

  static tokenExchangeFailed(desc: string): AuthError {
    return new AuthError(
      'tokenExchangeFailed',
      `Token exchange failed: ${desc}`,
      desc,
    );
  }
}
