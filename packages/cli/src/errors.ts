import { SevDeskError } from '@genz-its/sevdesk-sdk';
import { z } from 'zod';
import { ZodlineError } from 'zodline';

export function formatError(error: unknown): string {
  if (error instanceof ZodlineError) {
    return error.message;
  }
  if (error instanceof z.ZodError) {
    return error.issues
      .map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
      .join('\n');
  }
  if (error instanceof SevDeskError) {
    if (error.status === 401) {
      return 'Authentication failed. Check your API token or run `sevdesk login` again.';
    }
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}
