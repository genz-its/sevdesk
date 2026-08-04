import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import getCommand from '../src/commands/accounts-datev/get';
import listCommand from '../src/commands/accounts-datev/list';

const fetchMock = vi.fn();

function respondWith(objects: unknown) {
  fetchMock.mockResolvedValueOnce(
    new Response(JSON.stringify({ objects }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );
}

function requestAt(index: number): { url: URL; init: RequestInit } {
  const call = fetchMock.mock.calls[index];
  if (!call) {
    throw new Error('No fetch call recorded.');
  }
  return { url: new URL(call[0] as string), init: call[1] as RequestInit };
}

const account = {
  id: '4461',
  objectName: 'AccountDatev',
  number: '7610',
  name: 'Gewerbesteuer',
  taxRate: null,
  deprecated: '0',
  hidden: '0',
  deactivated: '0',
};

describe('accounts-datev commands', () => {
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

  it('lists visible accounts with limit and offset', async () => {
    respondWith([account]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await listCommand.action({ limit: 10, offset: 5, json: false }, undefined);
    const { url } = requestAt(0);
    expect(url.pathname).toBe('/api/v1/AccountDatev');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(url.searchParams.get('offset')).toBe('5');
    expect(log.mock.calls.flat().join('\n')).toContain('Gewerbesteuer');
  });

  it('filters by number client-side across all visible accounts', async () => {
    respondWith([{ ...account, id: '1', number: '4400' }, account]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await listCommand.action({ number: '7610', json: false }, undefined);
    expect(requestAt(0).url.searchParams.get('limit')).toBe('1000');
    const output = log.mock.calls.flat().join('\n');
    expect(output).toContain('7610');
    expect(output).not.toContain('4400');
  });

  it('filters by name client-side', async () => {
    respondWith([
      { ...account, id: '1', number: '4400', name: 'Erlöse 19 %' },
      account,
    ]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await listCommand.action({ nameLike: 'gewerbe', json: false }, undefined);
    expect(log.mock.calls.flat().join('\n')).not.toContain('Erlöse');
  });

  it('shows a single account as JSON', async () => {
    respondWith([account]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    await getCommand.action({ id: 4461, json: true }, undefined);
    expect(requestAt(0).url.pathname).toBe('/api/v1/AccountDatev/4461');
    expect(JSON.parse(log.mock.calls[0]?.[0] as string)).toEqual(account);
  });
});
