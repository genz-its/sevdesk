import { consola } from 'consola';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import create from '../src/commands/contacts/create';
import remove from '../src/commands/contacts/delete';
import get from '../src/commands/contacts/get';
import list from '../src/commands/contacts/list';
import update from '../src/commands/contacts/update';

const contact = {
  id: '42',
  objectName: 'Contact',
  name: null,
  surename: 'Jane',
  familyname: 'Doe',
  status: '1000',
  customerNumber: 'C-1',
  category: { id: '3', objectName: 'Category' },
  description: null,
  vatNumber: null,
  taxNumber: null,
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

describe('contact commands', () => {
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

  it('lists contacts and prints the person name', async () => {
    respondWith([contact]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await list.action(
      { name: 'Doe', customerNumber: 'C-1', limit: 10, json: false },
      undefined,
    );

    const { url, init } = lastRequest();
    expect(init.method).toBe('GET');
    expect(url.pathname).toBe('/api/v1/Contact');
    expect(url.searchParams.get('name')).toBe('Doe');
    expect(url.searchParams.get('customerNumber')).toBe('C-1');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(log.mock.calls.flat().join('\n')).toContain('Jane Doe');
  });

  it('reports an empty contact list', async () => {
    respondWith([]);
    const info = vi.spyOn(consola, 'info').mockImplementation(() => {});

    await list.action({ json: false }, undefined);

    expect(info).toHaveBeenCalledWith('No contacts found.');
  });

  it('prints a single contact as JSON', async () => {
    respondWith([contact]);
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await get.action({ id: 42, json: true }, undefined);

    expect(lastRequest().url.pathname).toBe('/api/v1/Contact/42');
    expect(JSON.parse(log.mock.calls[0]?.[0] as string)).toEqual(contact);
  });

  it('creates an organization contact', async () => {
    respondWith(contact);
    const success = vi.spyOn(consola, 'success').mockImplementation(() => {});

    await create.action(
      {
        name: 'ACME',
        category: 3,
        customerNumber: 'C-1',
        vatNumber: 'DE123',
        json: false,
      },
      undefined,
    );

    const { url, init } = lastRequest();
    expect(init.method).toBe('POST');
    expect(url.pathname).toBe('/api/v1/Contact');
    expect(JSON.parse(init.body as string)).toEqual({
      objectName: 'Contact',
      mapAll: true,
      category: { id: 3, objectName: 'Category' },
      name: 'ACME',
      customerNumber: 'C-1',
      vatNumber: 'DE123',
    });
    expect(success).toHaveBeenCalledWith('Created contact 42.');
  });

  it('updates only the provided fields', async () => {
    respondWith(contact);
    vi.spyOn(consola, 'success').mockImplementation(() => {});

    await update.action({ id: 42, description: 'VIP', json: false }, undefined);

    const { url, init } = lastRequest();
    expect(init.method).toBe('PUT');
    expect(url.pathname).toBe('/api/v1/Contact/42');
    expect(JSON.parse(init.body as string)).toEqual({
      objectName: 'Contact',
      mapAll: true,
      description: 'VIP',
    });
  });

  it('deletes a contact when confirmed via --yes', async () => {
    respondWith(null);
    const success = vi.spyOn(consola, 'success').mockImplementation(() => {});

    await remove.action({ id: 42, yes: true, json: false }, undefined);

    const { url, init } = lastRequest();
    expect(init.method).toBe('DELETE');
    expect(url.pathname).toBe('/api/v1/Contact/42');
    expect(success).toHaveBeenCalledWith('Contact deleted.');
  });

  it('exits when deleting without --yes in a non-interactive environment', async () => {
    const error = vi.spyOn(consola, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as (code?: number) => never);

    await expect(
      remove.action({ id: 42, yes: false, json: false }, undefined),
    ).rejects.toThrow('process.exit(1)');
    expect(error).toHaveBeenCalledWith(
      'You must pass --yes to confirm this action when running in a non-interactive environment.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
