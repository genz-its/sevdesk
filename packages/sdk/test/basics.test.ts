import { describe, expect, it } from 'vitest';
import { BasicsResource } from '../src/resources/basics';
import { createHttpClient, createMockFetch, lastRequest } from './helpers';

describe('BasicsResource', () => {
  it('requests the bookkeeping system version and returns the version string', async () => {
    const fetch = createMockFetch({ objects: { version: '2.0' } });
    const resource = new BasicsResource(createHttpClient(fetch));

    const version = await resource.getBookkeepingSystemVersion();

    expect(version).toBe('2.0');
    const { url, init } = lastRequest(fetch);
    expect(url).toBe(
      'https://my.sevdesk.de/api/v1/Tools/bookkeepingSystemVersion',
    );
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
  });
});
