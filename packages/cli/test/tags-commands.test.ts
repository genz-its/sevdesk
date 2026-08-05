import { consola } from 'consola';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import create from '../src/commands/tags/create';
import remove from '../src/commands/tags/delete';
import list from '../src/commands/tags/list';

const tag = {
  id: '3',
  objectName: 'Tag',
  create: '2024-03-01T00:00:00+02:00',
  name: 'Travel',
};

const tagRelation = {
  id: '9',
  objectName: 'TagRelation',
  create: '2024-03-01T00:00:00+02:00',
  tag: { id: '3', objectName: 'Tag' },
  object: { id: '42', objectName: 'Voucher' },
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

describe('tag commands', () => {
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

  it('lists tags', async () => {
    respondWith([tag]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await list.action({ limit: 20, json: false }, undefined);

    const { url, init } = firstRequest();
    expect(init.method).toBe('GET');
    expect(url.pathname).toBe('/api/v1/Tag');
    expect(url.searchParams.get('limit')).toBe('20');
    expect(log.mock.calls.flat().join('\n')).toContain('Travel');
  });

  it('reports an empty tag list', async () => {
    respondWith([]);
    const info = vi.spyOn(consola, 'info').mockImplementation(() => {});

    await list.action({ json: false }, undefined);

    expect(info).toHaveBeenCalledWith('No tags found.');
  });

  it('creates a tag for a document', async () => {
    respondWith(tagRelation);
    const success = vi.spyOn(consola, 'success').mockImplementation(() => {});

    await create.action(
      { name: 'Travel', objectType: 'Voucher', objectId: 42, json: false },
      undefined,
    );

    const { url, init } = lastRequest();
    expect(init.method).toBe('POST');
    expect(url.pathname).toBe('/api/v1/Tag/Factory/create');
    expect(JSON.parse(init.body as string)).toEqual({
      name: 'Travel',
      object: { id: 42, objectName: 'Voucher' },
    });
    expect(success).toHaveBeenCalledWith('Created tag 3.');
  });

  it('rejects an unknown document type', async () => {
    const error = vi.spyOn(consola, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as (code?: number) => never);

    await expect(
      create.action(
        { name: 'Travel', objectType: 'Contact', objectId: 42, json: false },
        undefined,
      ),
    ).rejects.toThrow('process.exit(1)');
    expect(error).toHaveBeenCalledWith(
      'The document type must be one of: Invoice, Voucher, Order, CreditNote.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('deletes a tag when confirmed via --yes', async () => {
    respondWith(null);
    const success = vi.spyOn(consola, 'success').mockImplementation(() => {});

    await remove.action({ id: 3, yes: true, json: false }, undefined);

    const { url, init } = lastRequest();
    expect(init.method).toBe('DELETE');
    expect(url.pathname).toBe('/api/v1/Tag/3');
    expect(success).toHaveBeenCalledWith('Tag deleted.');
  });

  it('exits when deleting without --yes in a non-interactive environment', async () => {
    const error = vi.spyOn(consola, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as (code?: number) => never);

    await expect(
      remove.action({ id: 3, yes: false, json: false }, undefined),
    ).rejects.toThrow('process.exit(1)');
    expect(error).toHaveBeenCalledWith(
      'You must pass --yes to confirm this action when running in a non-interactive environment.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
