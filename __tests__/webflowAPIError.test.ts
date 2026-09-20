import { describe, expect, it } from 'vitest';
import { WebflowAPIError } from '../src/services/api/errors';

describe('WebflowAPIError', () => {
  it('notFound message matches Activity UI copy', () => {
    expect(WebflowAPIError.notFound().message).toBe('Resource not found.');
  });

  it('rateLimited includes retry when present', () => {
    expect(WebflowAPIError.rateLimited(30).message).toContain('30');
  });
});
