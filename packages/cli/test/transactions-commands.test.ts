import { consola } from 'consola';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import create from '../src/commands/transactions/create';
import get from '../src/commands/transactions/get';
import list from '../src/commands/transactions/list';

const transaction = {
  id: '42',
  objectName: 'CheckAccountTransaction',
  valueDate: '2024-03-01T00:00:00+02:00',
  entryDate: null,
  paymtPurpose: 'Invoice 1',
  amount: '-12.5',
  payeePayerName: 'ACME',
  checkAccount: { id: '1', objectName: 'CheckAccount' },
  status: '100',
};

const fetchMock = vi.fn();

function jsonResponse(objects: unknown): Response {
  return new Response(JSON.stringify({ objects }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Serves one page followed by empty ones, so paginated commands terminate. */
function respondWith(objects: unknown): void {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(objects))
    .mockImplementation(async () => jsonResponse([]));
}

function firstRequest(): { url: URL; init: RequestInit } {
  const call = fetchMock.mock.calls[0];
  if (!call) {
    throw new Error('No fetch call recorded.');
  }
  return { url: new URL(call[0] as string), init: call[1] as RequestInit };
}

function lastRequest(): { url: URL; init: RequestInit } {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) {
    throw new Error('No fetch call recorded.');
  }
  return { url: new URL(call[0] as string), init: call[1] as RequestInit };
}

describe('transaction commands', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubEnv('SEVDESK_TOKEN', 'test-token');
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('filters unbooked transactions of a check account client-side', async () => {
    respondWith([
      transaction,
      { ...transaction, id: '2', payeePayerName: 'BOOKED CORP', status: '400' },
    ]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await list.action(
      {
        checkAccount: 1,
        unbooked: true,
        payee: 'ACME',
        limit: 10,
        json: false,
      },
      undefined,
    );

    const { url, init } = firstRequest();
    expect(init.method).toBe('GET');
    expect(url.pathname).toBe('/api/v1/CheckAccountTransaction');
    expect(url.searchParams.get('checkAccount[id]')).toBe('1');
    expect(url.searchParams.get('checkAccount[objectName]')).toBe(
      'CheckAccount',
    );
    expect(url.searchParams.has('isBooked')).toBe(false);
    expect(url.searchParams.get('payeePayerName')).toBe('ACME');
    // Client-side filtering needs full pages, so --limit must not cap the request.
    expect(Number(url.searchParams.get('limit'))).toBeGreaterThan(10);
    const output = log.mock.calls.flat().join('\n');
    expect(output).toContain('ACME');
    expect(output).not.toContain('BOOKED CORP');
  });

  it('collects unbooked transactions beyond the first page', async () => {
    const page = (from: number, count: number) =>
      Array.from({ length: count }, (_, index) => ({
        ...transaction,
        id: String(from + index),
        payeePayerName: `PAYEE ${from + index}`,
      }));
    fetchMock
      .mockResolvedValueOnce(jsonResponse(page(0, 1000)))
      .mockResolvedValueOnce(jsonResponse(page(1000, 156)))
      .mockImplementation(async () => jsonResponse([]));
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await list.action({ unbooked: true, json: true }, undefined);

    expect(JSON.parse(log.mock.calls[0]?.[0] as string)).toHaveLength(1156);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });

  it('keeps booked transactions when unbooked is not set', async () => {
    respondWith([
      { ...transaction, id: '2', payeePayerName: 'BOOKED CORP', status: '400' },
    ]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await list.action({ unbooked: false, json: false }, undefined);

    expect(lastRequest().url.searchParams.has('isBooked')).toBe(false);
    expect(log.mock.calls.flat().join('\n')).toContain('BOOKED CORP');
  });

  it('prints a single transaction as JSON', async () => {
    respondWith([transaction]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await get.action({ id: 42, json: true }, undefined);

    expect(lastRequest().url.pathname).toBe(
      '/api/v1/CheckAccountTransaction/42',
    );
    expect(JSON.parse(log.mock.calls[0]?.[0] as string)).toEqual(transaction);
  });

  it('creates a transaction', async () => {
    respondWith(transaction);
    const success = vi.spyOn(consola, 'success').mockImplementation(() => {});

    await create.action(
      {
        checkAccount: 1,
        amount: -12.5,
        payee: 'ACME',
        valueDate: '2024-03-01T00:00:00.000Z',
        purpose: 'Invoice 1',
        status: 100,
        json: false,
      },
      undefined,
    );

    const { url, init } = lastRequest();
    expect(init.method).toBe('POST');
    expect(url.pathname).toBe('/api/v1/CheckAccountTransaction');
    expect(JSON.parse(init.body as string)).toEqual({
      objectName: 'CheckAccountTransaction',
      mapAll: true,
      valueDate: '2024-03-01T00:00:00.000Z',
      amount: -12.5,
      payeePayerName: 'ACME',
      paymtPurpose: 'Invoice 1',
      checkAccount: { id: 1, objectName: 'CheckAccount' },
      status: 100,
    });
    expect(success).toHaveBeenCalledWith('Created transaction 42.');
  });

  it('exits when the check account is missing in a non-interactive environment', async () => {
    const error = vi.spyOn(consola, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as (code?: number) => never);

    await expect(
      create.action(
        { valueDate: '2024-03-01T00:00:00.000Z', status: 100, json: false },
        undefined,
      ),
    ).rejects.toThrow('process.exit(1)');
    expect(error).toHaveBeenCalledWith(
      'You must provide a check account ID via --check-account when running in a non-interactive environment.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
