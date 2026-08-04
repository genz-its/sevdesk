import type { vi } from 'vitest';
import { describe, expect, it } from 'vitest';
import { SevDeskError } from '../src/errors';
import { ContactAddressesResource } from '../src/resources/contact-addresses';
import { createHttpClient, createMockFetch, lastRequest } from './helpers';

const BASE_URL = 'https://my.sevdesk.de/api/v1';

function createResource(
  fetch: typeof globalThis.fetch,
): ContactAddressesResource {
  return new ContactAddressesResource(createHttpClient(fetch));
}

function parsedBody(fetch: ReturnType<typeof vi.fn>): Record<string, unknown> {
  return JSON.parse(lastRequest(fetch).init.body as string) as Record<
    string,
    unknown
  >;
}

describe('ContactAddressesResource.list', () => {
  it('requests contact addresses without pagination', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).list();

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/ContactAddress`);
    expect(init.method).toBe('GET');
  });

  it('serializes the pagination', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).list({ limit: 10, offset: 20 });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/ContactAddress?limit=10&offset=20`,
    );
  });
});

describe('ContactAddressesResource.get', () => {
  it('unwraps the single element array', async () => {
    const fetch = createMockFetch({ objects: [{ id: '1' }] });

    const address = await createResource(fetch).get({ contactAddressId: 1 });

    expect(address).toEqual({ id: '1' });
    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/ContactAddress/1`);
  });

  it('throws a 404 error when the array is empty', async () => {
    const fetch = createMockFetch({ objects: [] });

    await expect(
      createResource(fetch).get({ contactAddressId: 1 }),
    ).rejects.toThrow(SevDeskError);
    await expect(
      createResource(fetch).get({ contactAddressId: 1 }),
    ).rejects.toMatchObject({ status: 404, statusText: 'Not Found' });
  });
});

describe('ContactAddressesResource.create', () => {
  it('injects the boilerplate and builds the contact, country and category references', async () => {
    const fetch = createMockFetch({ objects: { id: '1' } });

    const address = await createResource(fetch).create({
      contactId: 42,
      countryId: 1,
      categoryId: 47,
      street: 'South road 15',
      zip: '12345',
      city: 'The North',
      name: 'John Snow',
    });

    expect(address).toEqual({ id: '1' });
    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/ContactAddress`);
    expect(init.method).toBe('POST');
    expect(parsedBody(fetch)).toEqual({
      objectName: 'ContactAddress',
      mapAll: true,
      contact: { id: 42, objectName: 'Contact' },
      country: { id: 1, objectName: 'StaticCountry' },
      category: { id: 47, objectName: 'Category' },
      street: 'South road 15',
      zip: '12345',
      city: 'The North',
      name: 'John Snow',
    });
  });

  it('omits the optional scalar fields when they are not given', async () => {
    const fetch = createMockFetch({ objects: { id: '1' } });

    await createResource(fetch).create({
      contactId: 42,
      countryId: 1,
      categoryId: 47,
    });

    expect(parsedBody(fetch)).toEqual({
      objectName: 'ContactAddress',
      mapAll: true,
      contact: { id: 42, objectName: 'Contact' },
      country: { id: 1, objectName: 'StaticCountry' },
      category: { id: 47, objectName: 'Category' },
    });
  });
});

describe('ContactAddressesResource.update', () => {
  it('excludes the contact address id from the body and omits the missing references', async () => {
    const fetch = createMockFetch({ objects: { id: '1' } });

    await createResource(fetch).update({
      contactAddressId: 1,
      city: 'Winterfell',
      countryId: 2,
    });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/ContactAddress/1`);
    expect(init.method).toBe('PUT');
    expect(parsedBody(fetch)).toEqual({
      objectName: 'ContactAddress',
      mapAll: true,
      country: { id: 2, objectName: 'StaticCountry' },
      city: 'Winterfell',
    });
  });
});

describe('ContactAddressesResource.delete', () => {
  it('deletes the contact address and returns nothing', async () => {
    const fetch = createMockFetch({ objects: [] });

    await expect(
      createResource(fetch).delete({ contactAddressId: 1 }),
    ).resolves.toBeUndefined();

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/ContactAddress/1`);
    expect(init.method).toBe('DELETE');
  });
});
