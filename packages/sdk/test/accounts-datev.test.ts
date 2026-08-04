import { describe, expect, it } from 'vitest';
import { AccountsDatevResource } from '../src/resources/accounts-datev';
import { createHttpClient, createMockFetch, lastRequest } from './helpers';

describe('AccountsDatevResource', () => {
  it('lists booking accounts with limit and offset', async () => {
    const fetch = createMockFetch({ objects: [] });
    const resource = new AccountsDatevResource(createHttpClient(fetch));
    await resource.list({ limit: 1000, offset: 50 });
    const { url, init } = lastRequest(fetch);
    expect(init.method).toBe('GET');
    expect(url).toBe(
      'https://my.sevdesk.de/api/v1/AccountDatev?limit=1000&offset=50',
    );
  });

  it('retrieves a single booking account', async () => {
    const fetch = createMockFetch({
      objects: [{ id: '4459', objectName: 'AccountDatev', number: '7608' }],
    });
    const resource = new AccountsDatevResource(createHttpClient(fetch));
    const account = await resource.get({ accountDatevId: 4459 });
    expect(lastRequest(fetch).url).toBe(
      'https://my.sevdesk.de/api/v1/AccountDatev/4459',
    );
    expect(account.number).toBe('7608');
  });

  it('throws a 404 error when the account does not exist', async () => {
    const fetch = createMockFetch({ objects: [] });
    const resource = new AccountsDatevResource(createHttpClient(fetch));
    await expect(resource.get({ accountDatevId: 1 })).rejects.toMatchObject({
      status: 404,
    });
  });
});
