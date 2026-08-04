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

function respondWith(objects: unknown): void {
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ objects }), {
      headers: { 'Content-Type': 'application/json' },
    }),
  );
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

  it('filters unbooked transactions of a check account', async () => {
    respondWith([transaction]);
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

    const { url, init } = lastRequest();
    expect(init.method).toBe('GET');
    expect(url.pathname).toBe('/api/v1/CheckAccountTransaction');
    expect(url.searchParams.get('checkAccount[id]')).toBe('1');
    expect(url.searchParams.get('checkAccount[objectName]')).toBe(
      'CheckAccount',
    );
    expect(url.searchParams.get('isBooked')).toBe('false');
    expect(url.searchParams.get('payeePayerName')).toBe('ACME');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(log.mock.calls.flat().join('\n')).toContain('ACME');
  });

  it('omits the booking filter when unbooked is not set', async () => {
    respondWith([]);
    const info = vi.spyOn(consola, 'info').mockImplementation(() => {});

    await list.action({ unbooked: false, json: false }, undefined);

    expect(lastRequest().url.searchParams.has('isBooked')).toBe(false);
    expect(info).toHaveBeenCalledWith('No transactions found.');
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
