import type { vi } from 'vitest';
import { describe, expect, it } from 'vitest';
import { SevDeskError } from '../src/errors';
import { PartsResource } from '../src/resources/parts';
import { createHttpClient, createMockFetch, lastRequest } from './helpers';

const BASE_URL = 'https://my.sevdesk.de/api/v1';

function createResource(fetch: typeof globalThis.fetch): PartsResource {
  return new PartsResource(createHttpClient(fetch));
}

function parsedBody(fetch: ReturnType<typeof vi.fn>): Record<string, unknown> {
  return JSON.parse(lastRequest(fetch).init.body as string) as Record<
    string,
    unknown
  >;
}

describe('PartsResource.list', () => {
  it('requests parts without filters', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).list();

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Part`);
    expect(init.method).toBe('GET');
  });

  it('serializes all filters', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).list({
      partNumber: 'Part-1000',
      name: 'Dragonglass',
      limit: 10,
      offset: 20,
      embed: ['unity', 'category'],
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Part?partNumber=Part-1000&name=Dragonglass` +
        '&limit=10&offset=20&embed=unity%2Ccategory',
    );
  });
});

describe('PartsResource.get', () => {
  it('unwraps the single element array', async () => {
    const fetch = createMockFetch({ objects: [{ id: '1' }] });

    const part = await createResource(fetch).get({ partId: 1 });

    expect(part).toEqual({ id: '1' });
    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/Part/1`);
  });

  it('throws a 404 error when the array is empty', async () => {
    const fetch = createMockFetch({ objects: [] });

    await expect(createResource(fetch).get({ partId: 1 })).rejects.toThrow(
      SevDeskError,
    );
    await expect(
      createResource(fetch).get({ partId: 1 }),
    ).rejects.toMatchObject({ status: 404, statusText: 'Not Found' });
  });
});

describe('PartsResource.create', () => {
  it('injects the boilerplate and builds the unity reference', async () => {
    const fetch = createMockFetch({ objects: { id: '1' } });

    const part = await createResource(fetch).create({
      name: 'Dragonglass',
      partNumber: 'Part-1000',
      unityId: 1,
      taxRate: 19,
      stock: 10,
      priceNet: 100,
      categoryId: 4,
      status: 100,
    });

    expect(part).toEqual({ id: '1' });
    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Part`);
    expect(init.method).toBe('POST');
    expect(parsedBody(fetch)).toEqual({
      objectName: 'Part',
      mapAll: true,
      name: 'Dragonglass',
      partNumber: 'Part-1000',
      unity: { id: 1, objectName: 'Unity' },
      taxRate: 19,
      stock: 10,
      category: { id: 4, objectName: 'Category' },
      priceNet: 100,
      status: 100,
    });
  });

  it('omits the category reference when no category id is given', async () => {
    const fetch = createMockFetch({ objects: { id: '1' } });

    await createResource(fetch).create({
      name: 'Dragonglass',
      partNumber: 'Part-1000',
      unityId: 1,
      taxRate: 0,
      stock: 0,
    });

    expect(parsedBody(fetch)).toEqual({
      objectName: 'Part',
      mapAll: true,
      name: 'Dragonglass',
      partNumber: 'Part-1000',
      unity: { id: 1, objectName: 'Unity' },
      taxRate: 0,
      stock: 0,
    });
  });
});

describe('PartsResource.update', () => {
  it('excludes the part id from the body and keeps the boilerplate', async () => {
    const fetch = createMockFetch({ objects: { id: '1' } });

    await createResource(fetch).update({
      partId: 1,
      priceGross: 119,
      stockEnabled: true,
    });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Part/1`);
    expect(init.method).toBe('PUT');
    expect(parsedBody(fetch)).toEqual({
      objectName: 'Part',
      mapAll: true,
      stockEnabled: true,
      priceGross: 119,
    });
  });
});

describe('PartsResource.getStock', () => {
  it('returns the unwrapped stock amount', async () => {
    const fetch = createMockFetch({ objects: 10 });

    const result = await createResource(fetch).getStock({ partId: 1 });

    expect(result).toBe(10);
    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/Part/1/getStock`);
  });
});
