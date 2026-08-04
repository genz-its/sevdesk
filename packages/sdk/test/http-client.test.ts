import { afterEach, describe, expect, it, vi } from 'vitest';
import { SevDeskError } from '../src/errors';
import { HttpClient } from '../src/http-client';
import { createHttpClient, createMockFetch, lastRequest } from './helpers';

function headersOf(init: RequestInit): Record<string, string> {
  return init.headers as Record<string, string>;
}

function createResponse(
  payload: unknown,
  init: { status: number; statusText: string },
): Response {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('HttpClient', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('headers', () => {
    it('sends the trimmed token without a bearer prefix', async () => {
      const fetch = createMockFetch({ objects: [] });
      const client = new HttpClient({ token: '  tok-with-spaces  ', fetch });

      await client.request({ method: 'GET', path: '/CheckAccount' });

      const headers = headersOf(lastRequest(fetch).init);
      expect(headers.Authorization).toBe('tok-with-spaces');
      expect(headers.Accept).toBe('application/json');
      expect(headers['User-Agent']).toBe('@genz-its/sevdesk-sdk');
    });

    it('sets a json content type for json bodies', async () => {
      const fetch = createMockFetch({ objects: [] });
      const client = createHttpClient(fetch);

      await client.request({
        method: 'POST',
        path: '/CheckAccount',
        body: { name: 'Iron Bank' },
      });

      const { init } = lastRequest(fetch);
      expect(headersOf(init)['Content-Type']).toBe('application/json');
      expect(init.body).toBe('{"name":"Iron Bank"}');
    });

    it('does not set a content type for form data bodies', async () => {
      const fetch = createMockFetch({ objects: [] });
      const client = createHttpClient(fetch);
      const formData = new FormData();
      formData.append('file', 'content');

      await client.request({ method: 'POST', path: '/Voucher', formData });

      const { init } = lastRequest(fetch);
      expect(headersOf(init)['Content-Type']).toBeUndefined();
      expect(init.body).toBe(formData);
    });
  });

  describe('response handling', () => {
    it('unwraps the objects envelope', async () => {
      const fetch = createMockFetch({ objects: [{ id: '1' }] });
      const client = createHttpClient(fetch);

      const result = await client.request({ method: 'GET', path: '/Test' });

      expect(result).toEqual([{ id: '1' }]);
    });

    it('returns payloads without an envelope as-is', async () => {
      const fetch = createMockFetch({ id: '1' });
      const client = createHttpClient(fetch);

      const result = await client.request({ method: 'GET', path: '/Test' });

      expect(result).toEqual({ id: '1' });
    });

    it('returns undefined for empty bodies', async () => {
      const fetch = createMockFetch(undefined);
      const client = createHttpClient(fetch);

      const result = await client.request({ method: 'GET', path: '/Test' });

      expect(result).toBeUndefined();
    });
  });

  describe('query serialization', () => {
    it('skips undefined values and stringifies the rest', async () => {
      const fetch = createMockFetch({ objects: [] });
      const client = createHttpClient(fetch);

      await client.request({
        method: 'GET',
        path: '/Test',
        query: {
          skipped: undefined,
          embed: ['contact', 'checkAccount'],
          isBooked: false,
          limit: 25,
          name: 'Iron Bank',
        },
      });

      const query = new URL(lastRequest(fetch).url).searchParams;
      expect(Object.fromEntries(query)).toEqual({
        embed: 'contact,checkAccount',
        isBooked: '0',
        limit: '25',
        name: 'Iron Bank',
      });
      expect(query.has('skipped')).toBe(false);
    });
  });

  describe('errors', () => {
    it('throws a SevDeskError with the extracted message', async () => {
      const fetch = createMockFetch(
        { error: { message: 'Parameter name is missing.' } },
        { status: 400, statusText: 'Bad Request' },
      );
      const client = createHttpClient(fetch);

      const error = await client
        .request({ method: 'POST', path: '/Test' })
        .catch((error: unknown) => error);

      expect(error).toBeInstanceOf(SevDeskError);
      expect(error).toMatchObject({
        message: 'Parameter name is missing.',
        status: 400,
        statusText: 'Bad Request',
        body: { error: { message: 'Parameter name is missing.' } },
      });
    });
  });

  describe('retries', () => {
    it('retries a GET request on a server error', async () => {
      vi.useFakeTimers();
      const fetch = vi
        .fn()
        .mockResolvedValueOnce(
          createResponse(
            { error: 'boom' },
            {
              status: 500,
              statusText: 'Internal Server Error',
            },
          ),
        )
        .mockResolvedValueOnce(
          createResponse(
            { objects: [{ id: '1' }] },
            {
              status: 200,
              statusText: 'OK',
            },
          ),
        );
      const client = createHttpClient(fetch);

      const promise = client.request({ method: 'GET', path: '/Test' });
      await vi.advanceTimersByTimeAsync(60_000);

      expect(await promise).toEqual([{ id: '1' }]);
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('does not retry a POST request on a server error', async () => {
      const fetch = createMockFetch(
        { error: { message: 'boom' } },
        { status: 500, statusText: 'Internal Server Error' },
      );
      const client = createHttpClient(fetch);

      await expect(
        client.request({ method: 'POST', path: '/Test' }),
      ).rejects.toMatchObject({ status: 500 });
      expect(fetch).toHaveBeenCalledTimes(1);
    });
  });
});
