import { SevDeskError } from '@genz-its/sevdesk-sdk';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ZodlineError } from 'zodline';
import { formatError } from '../src/errors';

describe('formatError', () => {
  it('passes ZodlineError messages through', () => {
    expect(formatError(new ZodlineError('Unknown command: foo'))).toBe(
      'Unknown command: foo',
    );
  });

  it('formats ZodError issues as one line per issue', () => {
    const result = z.object({ limit: z.number() }).safeParse({ limit: 'x' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(formatError(result.error)).toMatch(/^limit: /);
    }
  });

  it('maps 401 errors to a login hint', () => {
    const error = new SevDeskError({
      status: 401,
      statusText: 'Unauthorized',
      body: null,
    });
    expect(formatError(error)).toContain('sevdesk login');
  });

  it('uses the API message for other SevDeskErrors', () => {
    const error = new SevDeskError({
      status: 422,
      statusText: 'Unprocessable Entity',
      body: { error: { message: 'Validation failed' } },
    });
    expect(formatError(error)).toBe('Validation failed');
  });

  it('stringifies unknown errors', () => {
    expect(formatError('boom')).toBe('boom');
  });
});
