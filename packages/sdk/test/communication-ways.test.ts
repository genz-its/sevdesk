import type { vi } from 'vitest';
import { describe, expect, it } from 'vitest';
import { SevDeskError } from '../src/errors';
import { CommunicationWaysResource } from '../src/resources/communication-ways';
import { createHttpClient, createMockFetch, lastRequest } from './helpers';

const BASE_URL = 'https://my.sevdesk.de/api/v1';

function createResource(
  fetch: typeof globalThis.fetch,
): CommunicationWaysResource {
  return new CommunicationWaysResource(createHttpClient(fetch));
}

function parsedBody(fetch: ReturnType<typeof vi.fn>): Record<string, unknown> {
  return JSON.parse(lastRequest(fetch).init.body as string) as Record<
    string,
    unknown
  >;
}

describe('CommunicationWaysResource.list', () => {
  it('requests communication ways without filters', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).list();

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/CommunicationWay`);
    expect(init.method).toBe('GET');
  });

  it('serializes all filters including the bracket contact filter', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).list({
      contactId: 42,
      type: 'EMAIL',
      main: '1',
      limit: 10,
      offset: 20,
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/CommunicationWay` +
        '?contact%5Bid%5D=42&contact%5BobjectName%5D=Contact' +
        '&type=EMAIL&main=1&limit=10&offset=20',
    );
  });

  it('omits the contact object name when no contact id is given', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).list({ type: 'PHONE' });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/CommunicationWay?type=PHONE`,
    );
  });
});

describe('CommunicationWaysResource.get', () => {
  it('unwraps the single element array', async () => {
    const fetch = createMockFetch({ objects: [{ id: '1' }] });

    const communicationWay = await createResource(fetch).get({
      communicationWayId: 1,
    });

    expect(communicationWay).toEqual({ id: '1' });
    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/CommunicationWay/1`);
  });

  it('throws a 404 error when the array is empty', async () => {
    const fetch = createMockFetch({ objects: [] });

    await expect(
      createResource(fetch).get({ communicationWayId: 1 }),
    ).rejects.toThrow(SevDeskError);
    await expect(
      createResource(fetch).get({ communicationWayId: 1 }),
    ).rejects.toMatchObject({ status: 404, statusText: 'Not Found' });
  });
});

describe('CommunicationWaysResource.create', () => {
  it('injects the boilerplate and builds the contact and key references', async () => {
    const fetch = createMockFetch({ objects: { id: '1' } });

    const communicationWay = await createResource(fetch).create({
      contactId: 42,
      type: 'EMAIL',
      value: 'john.snow@example.com',
      keyId: 2,
      main: true,
    });

    expect(communicationWay).toEqual({ id: '1' });
    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/CommunicationWay`);
    expect(init.method).toBe('POST');
    expect(parsedBody(fetch)).toEqual({
      objectName: 'CommunicationWay',
      mapAll: true,
      contact: { id: 42, objectName: 'Contact' },
      type: 'EMAIL',
      value: 'john.snow@example.com',
      key: { id: 2, objectName: 'CommunicationWayKey' },
      main: true,
    });
  });

  it('omits the main flag when it is not given', async () => {
    const fetch = createMockFetch({ objects: { id: '1' } });

    await createResource(fetch).create({
      contactId: 42,
      type: 'WEB',
      value: 'https://example.com',
      keyId: 5,
    });

    expect(parsedBody(fetch)).toEqual({
      objectName: 'CommunicationWay',
      mapAll: true,
      contact: { id: 42, objectName: 'Contact' },
      type: 'WEB',
      value: 'https://example.com',
      key: { id: 5, objectName: 'CommunicationWayKey' },
    });
  });
});

describe('CommunicationWaysResource.update', () => {
  it('excludes the communication way id from the body and omits the missing references', async () => {
    const fetch = createMockFetch({ objects: { id: '1' } });

    await createResource(fetch).update({
      communicationWayId: 1,
      value: '+49 123 456789',
      keyId: 4,
    });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/CommunicationWay/1`);
    expect(init.method).toBe('PUT');
    expect(parsedBody(fetch)).toEqual({
      objectName: 'CommunicationWay',
      mapAll: true,
      value: '+49 123 456789',
      key: { id: 4, objectName: 'CommunicationWayKey' },
    });
  });
});

describe('CommunicationWaysResource.delete', () => {
  it('deletes the communication way and returns nothing', async () => {
    const fetch = createMockFetch({ objects: [] });

    await expect(
      createResource(fetch).delete({ communicationWayId: 1 }),
    ).resolves.toBeUndefined();

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/CommunicationWay/1`);
    expect(init.method).toBe('DELETE');
  });
});

describe('CommunicationWaysResource.listKeys', () => {
  it('requests the communication way keys', async () => {
    const fetch = createMockFetch({ objects: [{ id: '2', name: 'Arbeit' }] });

    const keys = await createResource(fetch).listKeys();

    expect(keys).toEqual([{ id: '2', name: 'Arbeit' }]);
    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/CommunicationWayKey`);
    expect(init.method).toBe('GET');
  });
});
