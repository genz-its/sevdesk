import { consola } from 'consola';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import addAddress from '../src/commands/contacts/add-address';
import addEmail from '../src/commands/contacts/add-email';
import addPhone from '../src/commands/contacts/add-phone';
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

const address = {
  id: '7',
  objectName: 'ContactAddress',
  contact: { id: '42', objectName: 'Contact' },
  street: 'South road 15',
  zip: '12345',
  city: 'The North',
  country: { id: '1', objectName: 'StaticCountry' },
  category: { id: '47', objectName: 'Category' },
};

const communicationWay = {
  id: '9',
  objectName: 'CommunicationWay',
  contact: { id: '42', objectName: 'Contact' },
  type: 'EMAIL',
  value: 'jane@example.com',
  key: { id: '2', objectName: 'CommunicationWayKey' },
  main: '1',
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

/** Serves one response per value in request order, then empty pages. */
function respondWithEach(...objects: unknown[]): void {
  for (const value of objects) {
    fetchMock.mockResolvedValueOnce(jsonResponse(value));
  }
  fetchMock.mockImplementation(async () => jsonResponse([]));
}

function requestAt(index: number): { url: URL; init: RequestInit } {
  const call = fetchMock.mock.calls[index];
  if (!call) {
    throw new Error(`No fetch call recorded at index ${index}.`);
  }
  return { url: new URL(call[0] as string), init: call[1] as RequestInit };
}

function lastRequest(): { url: URL; init: RequestInit } {
  return requestAt(fetchMock.mock.calls.length - 1);
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

    const { url, init } = requestAt(0);
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

  it('filters contacts by depth and category', async () => {
    respondWith([contact]);
    vi.spyOn(console, 'log').mockImplementation(() => {});

    await list.action({ depth: 1, category: 2, json: false }, undefined);

    const { url } = lastRequest();
    expect(url.searchParams.get('depth')).toBe('1');
    expect(url.searchParams.get('category[id]')).toBe('2');
    expect(url.searchParams.get('category[objectName]')).toBe('Category');
  });

  it('prints a single contact with its addresses and communication ways as JSON', async () => {
    respondWithEach(
      [contact],
      [address, { ...address, id: '8', contact: { id: '43' } }],
      [],
      [communicationWay],
    );
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});

    await get.action({ id: 42, json: true }, undefined);

    expect(requestAt(0).url.pathname).toBe('/api/v1/Contact/42');
    const addressRequest = requestAt(1);
    expect(addressRequest.url.pathname).toBe('/api/v1/ContactAddress');
    expect(addressRequest.url.searchParams.get('offset')).toBe('0');
    expect(requestAt(2).url.searchParams.get('offset')).toBe('2');
    const communicationWayRequest = requestAt(3);
    expect(communicationWayRequest.url.pathname).toBe(
      '/api/v1/CommunicationWay',
    );
    expect(communicationWayRequest.url.searchParams.get('contact[id]')).toBe(
      '42',
    );
    expect(
      communicationWayRequest.url.searchParams.get('contact[objectName]'),
    ).toBe('Contact');
    expect(JSON.parse(log.mock.calls[0]?.[0] as string)).toEqual({
      contact,
      addresses: [address],
      communicationWays: [communicationWay],
    });
  });

  it('prints the address and communication way sections of a contact', async () => {
    respondWithEach([contact], [address], [], [communicationWay]);
    const info = vi.spyOn(consola, 'info').mockImplementation(() => {});

    await get.action({ id: 42, json: false }, undefined);

    const output = info.mock.calls.flat().join('\n');
    expect(output).toContain('Addresses:');
    expect(output).toContain('South road 15, 12345 The North, country 1');
    expect(output).toContain('Communication ways:');
    expect(output).toContain('EMAIL: jane@example.com (main)');
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

  it('adds an address with a country and category reference', async () => {
    respondWith(address);
    const success = vi.spyOn(consola, 'success').mockImplementation(() => {});

    await addAddress.action(
      {
        contact: 42,
        street: 'South road 15',
        zip: '12345',
        city: 'The North',
        country: 1,
        category: 47,
        json: false,
      },
      undefined,
    );

    const { url, init } = lastRequest();
    expect(init.method).toBe('POST');
    expect(url.pathname).toBe('/api/v1/ContactAddress');
    expect(JSON.parse(init.body as string)).toEqual({
      objectName: 'ContactAddress',
      mapAll: true,
      contact: { id: 42, objectName: 'Contact' },
      country: { id: 1, objectName: 'StaticCountry' },
      category: { id: 47, objectName: 'Category' },
      street: 'South road 15',
      zip: '12345',
      city: 'The North',
    });
    expect(success).toHaveBeenCalledWith('Created contact address 7.');
  });

  it('exits when adding an address without a contact in a non-interactive environment', async () => {
    const error = vi.spyOn(consola, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as (code?: number) => never);

    await expect(
      addAddress.action({ country: 1, category: 47, json: false }, undefined),
    ).rejects.toThrow('process.exit(1)');
    expect(error).toHaveBeenCalledWith(
      'You must provide a contact ID via --contact when running in a non-interactive environment.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('adds an e-mail communication way with the work key', async () => {
    respondWith(communicationWay);
    const success = vi.spyOn(consola, 'success').mockImplementation(() => {});

    await addEmail.action(
      {
        contact: 42,
        email: 'jane@example.com',
        key: 2,
        main: true,
        json: false,
      },
      undefined,
    );

    const { url, init } = lastRequest();
    expect(init.method).toBe('POST');
    expect(url.pathname).toBe('/api/v1/CommunicationWay');
    expect(JSON.parse(init.body as string)).toEqual({
      objectName: 'CommunicationWay',
      mapAll: true,
      contact: { id: 42, objectName: 'Contact' },
      type: 'EMAIL',
      value: 'jane@example.com',
      key: { id: 2, objectName: 'CommunicationWayKey' },
      main: true,
    });
    expect(success).toHaveBeenCalledWith('Created e-mail communication way 9.');
  });

  it('exits when the e-mail address contains no at sign', async () => {
    const error = vi.spyOn(consola, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      throw new Error(`process.exit(${code})`);
    }) as (code?: number) => never);

    await expect(
      addEmail.action(
        {
          contact: 42,
          email: 'jane.example.com',
          key: 2,
          main: false,
          json: false,
        },
        undefined,
      ),
    ).rejects.toThrow('process.exit(1)');
    expect(error).toHaveBeenCalledWith(
      'The e-mail address must contain an "@".',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('adds a phone communication way', async () => {
    respondWith({ ...communicationWay, type: 'PHONE', value: '+49 30 123456' });
    vi.spyOn(consola, 'success').mockImplementation(() => {});

    await addPhone.action(
      {
        contact: 42,
        phone: '+49 30 123456',
        key: 2,
        main: false,
        json: false,
      },
      undefined,
    );

    expect(JSON.parse(lastRequest().init.body as string)).toMatchObject({
      type: 'PHONE',
      value: '+49 30 123456',
      key: { id: 2, objectName: 'CommunicationWayKey' },
      main: false,
    });
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
