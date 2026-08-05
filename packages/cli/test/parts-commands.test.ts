import { consola } from 'consola';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import get from '../src/commands/parts/get';
import list from '../src/commands/parts/list';

const part = {
  id: '7',
  objectName: 'Part',
  name: 'Consulting',
  partNumber: 'P-1',
  text: null,
  stock: '5',
  price: '100',
  priceNet: null,
  priceGross: null,
  taxRate: '19',
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

describe('part commands', () => {
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

  it('lists parts filtered by name and part number', async () => {
    respondWith([part]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await list.action(
      {
        name: 'Consulting',
        partNumber: 'P-1',
        limit: 5,
        offset: 10,
        json: false,
      },
      undefined,
    );

    const { url, init } = firstRequest();
    expect(init.method).toBe('GET');
    expect(url.pathname).toBe('/api/v1/Part');
    expect(url.searchParams.get('name')).toBe('Consulting');
    expect(url.searchParams.get('partNumber')).toBe('P-1');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(url.searchParams.get('offset')).toBe('10');
    expect(log.mock.calls.flat().join('\n')).toContain('Consulting');
  });

  it('reports an empty part list', async () => {
    respondWith([]);
    const info = vi.spyOn(consola, 'info').mockImplementation(() => {});

    await list.action({ json: false }, undefined);

    expect(info).toHaveBeenCalledWith('No parts found.');
  });

  it('prints a single part as JSON', async () => {
    respondWith([part]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await get.action({ id: 7, json: true }, undefined);

    expect(lastRequest().url.pathname).toBe('/api/v1/Part/7');
    expect(JSON.parse(log.mock.calls[0]?.[0] as string)).toEqual(part);
  });

  it('prints the main fields of a part', async () => {
    respondWith([part]);
    const info = vi.spyOn(consola, 'info').mockImplementation(() => {});

    await get.action({ id: 7, json: false }, undefined);

    expect(info).toHaveBeenCalledWith('Part number: P-1');
    expect(info).toHaveBeenCalledWith('Tax rate: 19');
    expect(info).toHaveBeenCalledWith('Stock: 5');
  });

  it('exits when the part ID is missing in a non-interactive environment', async () => {
    const error = vi.spyOn(consola, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as (code?: number) => never);

    await expect(get.action({ json: false }, undefined)).rejects.toThrow(
      'process.exit(1)',
    );
    expect(error).toHaveBeenCalledWith(
      'You must provide a part ID via --id when running in a non-interactive environment.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
