import { consola } from 'consola';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import balance from '../src/commands/accounts/balance';
import createClearing from '../src/commands/accounts/create-clearing';
import createFileImport from '../src/commands/accounts/create-file-import';
import get from '../src/commands/accounts/get';
import list from '../src/commands/accounts/list';

const checkAccount = {
  id: '7',
  objectName: 'CheckAccount',
  name: 'Business account',
  iban: 'DE02120300000000202051',
  type: 'online',
  importType: 'CSV',
  currency: 'EUR',
  balance: '100.00',
  status: '100',
  accountingNumber: '1800',
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

describe('check account commands', () => {
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

  it('lists check accounts as a table', async () => {
    respondWith([checkAccount]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await list.action({ limit: 5, json: false }, undefined);

    const { url, init } = lastRequest();
    expect(init.method).toBe('GET');
    expect(url.pathname).toBe('/api/v1/CheckAccount');
    expect(url.searchParams.get('limit')).toBe('5');
    const output = log.mock.calls.flat().join('\n');
    expect(output).toContain('IMPORTTYPE');
    expect(output).toContain('Business account');
  });

  it('shows a single check account', async () => {
    respondWith([checkAccount]);
    const info = vi.spyOn(consola, 'info').mockImplementation(() => {});

    await get.action({ id: 7, json: false }, undefined);

    expect(lastRequest().url.pathname).toBe('/api/v1/CheckAccount/7');
    expect(info).toHaveBeenCalledWith('Name: Business account');
  });

  it('reads the balance at a date', async () => {
    respondWith('123.45');
    const info = vi.spyOn(consola, 'info').mockImplementation(() => {});

    await balance.action({ id: 7, date: '2024-01-31', json: false }, undefined);

    const { url } = lastRequest();
    expect(url.pathname).toBe('/api/v1/CheckAccount/7/getBalanceAtDate');
    expect(url.searchParams.get('date')).toBe('2024-01-31');
    expect(info).toHaveBeenCalledWith('Balance at 2024-01-31: 123.45');
  });

  it('creates a clearing account', async () => {
    respondWith(checkAccount);
    const success = vi.spyOn(consola, 'success').mockImplementation(() => {});

    await createClearing.action(
      { name: 'Clearing', accountingNumber: 1590, json: false },
      undefined,
    );

    const { url, init } = lastRequest();
    expect(init.method).toBe('POST');
    expect(url.pathname).toBe('/api/v1/CheckAccount/Factory/clearingAccount');
    expect(JSON.parse(init.body as string)).toEqual({
      name: 'Clearing',
      accountingNumber: 1590,
    });
    expect(success).toHaveBeenCalledWith('Created clearing account 7.');
  });

  it('creates a file import account with the default import type', async () => {
    respondWith(checkAccount);
    vi.spyOn(consola, 'success').mockImplementation(() => {});

    await createFileImport.action(
      { name: 'Import', importType: 'CSV', json: false },
      undefined,
    );

    const { url, init } = lastRequest();
    expect(url.pathname).toBe('/api/v1/CheckAccount/Factory/fileImportAccount');
    expect(JSON.parse(init.body as string)).toEqual({
      name: 'Import',
      importType: 'CSV',
    });
  });

  it('exits when the name is missing in a non-interactive environment', async () => {
    const error = vi.spyOn(consola, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as (code?: number) => never);

    await expect(
      createClearing.action({ json: false }, undefined),
    ).rejects.toThrow('process.exit(1)');
    expect(error).toHaveBeenCalledWith(
      'You must provide a name via --name when running in a non-interactive environment.',
    );
  });
});
