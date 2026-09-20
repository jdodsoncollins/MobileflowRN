export type WebflowAPIErrorKind =
  | 'rateLimited'
  | 'unauthorized'
  | 'notFound'
  | 'invalidResponse'
  | 'uploadFailed'
  | 'decodeFailed';

export class WebflowAPIError extends Error {
  readonly kind: WebflowAPIErrorKind;
  readonly retryAfter?: number | null;
  readonly resource?: string;

  constructor(
    kind: WebflowAPIErrorKind,
    message: string,
    opts?: { retryAfter?: number | null; resource?: string },
  ) {
    super(message);
    this.name = 'WebflowAPIError';
    this.kind = kind;
    this.retryAfter = opts?.retryAfter;
    this.resource = opts?.resource;
  }

  static rateLimited(retryAfter?: number | null): WebflowAPIError {
    const message =
      retryAfter != null
        ? `Webflow rate limit: wait ${Math.floor(retryAfter)}s then retry (publish is often 1 success/minute).`
        : 'Webflow rate limit hit. Wait about a minute before publishing again.';
    return new WebflowAPIError('rateLimited', message, { retryAfter });
  }

  static unauthorized(): WebflowAPIError {
    return new WebflowAPIError(
      'unauthorized',
      'Missing required Webflow scope or session expired. Reconnect in Settings.',
    );
  }

  static notFound(): WebflowAPIError {
    return new WebflowAPIError('notFound', 'Resource not found.');
  }

  static invalidResponse(detail: string): WebflowAPIError {
    return new WebflowAPIError(
      'invalidResponse',
      `Invalid Webflow response: ${detail}`,
    );
  }

  static uploadFailed(detail: string): WebflowAPIError {
    return new WebflowAPIError(
      'uploadFailed',
      `Asset upload failed: ${detail}`,
    );
  }

  static decodeFailed(resource: string, detail: string): WebflowAPIError {
    return new WebflowAPIError(
      'decodeFailed',
      `Could not parse Webflow ${resource} response (${detail}). OAuth may still be valid.`,
      { resource },
    );
  }

  get isRateLimited(): boolean {
    return this.kind === 'rateLimited';
  }
}
