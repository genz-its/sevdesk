export class SevDeskError extends Error {
  public readonly status: number;
  public readonly statusText: string;
  public readonly body: unknown;

  constructor(options: { status: number; statusText: string; body: unknown }) {
    super(extractMessage(options));
    this.name = 'SevDeskError';
    this.status = options.status;
    this.statusText = options.statusText;
    this.body = options.body;
  }
}

function extractMessage(options: {
  status: number;
  statusText: string;
  body: unknown;
}): string {
  const fallback = `sevdesk API error: ${options.status} ${options.statusText}`;
  const body = options.body;
  if (typeof body === 'string' && body.length > 0) {
    return body;
  }
  if (typeof body === 'object' && body !== null) {
    const error = (body as { error?: unknown }).error;
    if (typeof error === 'object' && error !== null) {
      const message = (error as { message?: unknown }).message;
      if (typeof message === 'string' && message.length > 0) {
        return message;
      }
    }
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
  }
  return fallback;
}
