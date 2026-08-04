import { vi } from 'vitest';
import { HttpClient } from '../src/http-client';

export function createMockFetch(
  payload: unknown,
  init?: {
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
  },
) {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(payload), {
        status: init?.status ?? 200,
        statusText: init?.statusText ?? 'OK',
        headers: { 'Content-Type': 'application/json', ...init?.headers },
      }),
  );
}

export function createHttpClient(fetch: typeof globalThis.fetch): HttpClient {
  return new HttpClient({ token: 'test-token', fetch });
}

export function lastRequest(fetch: ReturnType<typeof vi.fn>): {
  url: string;
  init: RequestInit;
} {
  const call = fetch.mock.calls.at(-1);
  if (!call) {
    throw new Error('No fetch call recorded.');
  }
  return { url: call[0] as string, init: call[1] as RequestInit };
}
