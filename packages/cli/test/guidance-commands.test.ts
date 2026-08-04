import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import accounts from '../src/commands/guidance/accounts';

function taxRule(name: string) {
  return { id: 1, name, description: name, taxRates: ['NINETEEN'] };
}

const guide = {
  accountDatevId: 27,
  accountNumber: '4000',
  accountName: 'Umsatzerlöse',
  description: 'Einnahmen aus dem Verkauf von Waren',
  allowedTaxRules: [taxRule('USTPFL_UMS_EINN')],
  allowedReceiptTypes: ['REVENUE'],
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

describe('receipt guidance commands', () => {
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

  it('requests guidance for a tax rule and prints a table', async () => {
    respondWith([guide]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await accounts.action(
      {
        taxRule: 'USTPFL_UMS_EINN',
        revenue: false,
        expense: false,
        json: false,
      },
      undefined,
    );

    const { url, init } = lastRequest();
    expect(init.method).toBe('GET');
    expect(url.pathname).toBe('/api/v1/ReceiptGuidance/forTaxRule');
    expect(url.searchParams.get('taxRule')).toBe('USTPFL_UMS_EINN');
    const output = log.mock.calls.flat().join('\n');
    expect(output).toContain('TAXRULES');
    expect(output).toContain('27');
    expect(output).toContain('USTPFL_UMS_EINN');
  });

  it('requests guidance for all accounts without a filter', async () => {
    respondWith([guide]);
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await accounts.action(
      { revenue: false, expense: false, json: false },
      undefined,
    );

    expect(lastRequest().url.pathname).toBe(
      '/api/v1/ReceiptGuidance/forAllAccounts',
    );
  });

  it('prefers the account number over the other filters', async () => {
    respondWith([guide]);
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await accounts.action(
      {
        accountNumber: '4000',
        taxRule: 'USTPFL_UMS_EINN',
        revenue: true,
        expense: false,
        json: false,
      },
      undefined,
    );

    const { url } = lastRequest();
    expect(url.pathname).toBe('/api/v1/ReceiptGuidance/forAccountNumber');
    expect(url.searchParams.get('accountNumber')).toBe('4000');
  });

  it('requests guidance for revenue accounts', async () => {
    respondWith([guide]);
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await accounts.action(
      { revenue: true, expense: true, json: false },
      undefined,
    );

    expect(lastRequest().url.pathname).toBe(
      '/api/v1/ReceiptGuidance/forRevenue',
    );
  });

  it('truncates long tax rule lists', async () => {
    respondWith([
      {
        ...guide,
        allowedTaxRules: ['A', 'B', 'C', 'D'].map(taxRule),
      },
    ]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await accounts.action(
      { revenue: false, expense: false, json: false },
      undefined,
    );

    expect(log.mock.calls.flat().join('\n')).toContain('A, B, C, …');
  });
});
