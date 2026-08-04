import type { vi } from 'vitest';
import { describe, expect, it } from 'vitest';
import { SevDeskError } from '../src/errors';
import { TagsResource } from '../src/resources/tags';
import { createHttpClient, createMockFetch, lastRequest } from './helpers';

const BASE_URL = 'https://my.sevdesk.de/api/v1';

function createResource(fetch: typeof globalThis.fetch): TagsResource {
  return new TagsResource(createHttpClient(fetch));
}

function parsedBody(fetch: ReturnType<typeof vi.fn>): Record<string, unknown> {
  return JSON.parse(lastRequest(fetch).init.body as string) as Record<
    string,
    unknown
  >;
}

describe('TagsResource.list', () => {
  it('requests tags without filters', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).list();

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Tag`);
    expect(init.method).toBe('GET');
  });

  it('serializes the name filter with limit and offset', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).list({ name: 'Winter', limit: 10, offset: 20 });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Tag?name=Winter&limit=10&offset=20`,
    );
  });
});

describe('TagsResource.get', () => {
  it('unwraps the single element array', async () => {
    const fetch = createMockFetch({ objects: [{ id: '1' }] });

    const tag = await createResource(fetch).get({ tagId: 1 });

    expect(tag).toEqual({ id: '1' });
    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/Tag/1`);
  });

  it('throws a 404 error when the array is empty', async () => {
    const fetch = createMockFetch({ objects: [] });

    await expect(createResource(fetch).get({ tagId: 1 })).rejects.toThrow(
      SevDeskError,
    );
    await expect(createResource(fetch).get({ tagId: 1 })).rejects.toMatchObject(
      {
        status: 404,
        statusText: 'Not Found',
      },
    );
  });
});

describe('TagsResource.create', () => {
  it('builds the object reference and returns the tag relation', async () => {
    const fetch = createMockFetch({
      objects: { id: '9', objectName: 'TagRelation' },
    });

    const relation = await createResource(fetch).create({
      name: 'Winter',
      objectId: 1,
      objectName: 'Invoice',
    });

    expect(relation).toEqual({ id: '9', objectName: 'TagRelation' });
    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Tag/Factory/create`);
    expect(init.method).toBe('POST');
    expect(parsedBody(fetch)).toEqual({
      name: 'Winter',
      object: { id: 1, objectName: 'Invoice' },
    });
  });
});

describe('TagsResource.update', () => {
  it('sends only the name', async () => {
    const fetch = createMockFetch({ objects: { id: '1' } });

    await createResource(fetch).update({ tagId: 1, name: 'Summer' });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Tag/1`);
    expect(init.method).toBe('PUT');
    expect(parsedBody(fetch)).toEqual({ name: 'Summer' });
  });
});

describe('TagsResource.delete', () => {
  it('deletes the tag and returns nothing', async () => {
    const fetch = createMockFetch({ objects: [] });

    await expect(
      createResource(fetch).delete({ tagId: 1 }),
    ).resolves.toBeUndefined();

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Tag/1`);
    expect(init.method).toBe('DELETE');
  });
});

describe('TagsResource.listRelations', () => {
  it('requests tag relations with limit and offset', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).listRelations({ limit: 5, offset: 10 });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/TagRelation?limit=5&offset=10`);
    expect(init.method).toBe('GET');
  });
});
