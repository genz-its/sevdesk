import type { vi } from 'vitest';
import { describe, expect, it } from 'vitest';
import { SevDeskError } from '../src/errors';
import { ContactsResource } from '../src/resources/contacts';
import { createHttpClient, createMockFetch, lastRequest } from './helpers';

const BASE_URL = 'https://my.sevdesk.de/api/v1';

function createResource(fetch: typeof globalThis.fetch): ContactsResource {
  return new ContactsResource(createHttpClient(fetch));
}

function parsedBody(fetch: ReturnType<typeof vi.fn>): Record<string, unknown> {
  return JSON.parse(lastRequest(fetch).init.body as string) as Record<
    string,
    unknown
  >;
}

describe('ContactsResource.list', () => {
  it('requests contacts without filters', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).list();

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Contact`);
    expect(init.method).toBe('GET');
  });

  it('serializes all filters including the bracket filters', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).list({
      depth: '1',
      customerNumber: 'KD-1000',
      name: 'Snow',
      categoryId: 3,
      parentId: 7,
      limit: 10,
      offset: 20,
      embed: ['category', 'parent'],
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Contact?depth=1&customerNumber=KD-1000&name=Snow` +
        '&category%5Bid%5D=3&category%5BobjectName%5D=Category' +
        '&parent%5Bid%5D=7&parent%5BobjectName%5D=Contact' +
        '&limit=10&offset=20&embed=category%2Cparent',
    );
  });

  it('omits the bracket object names when no ids are given', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).list({ depth: '0' });

    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/Contact?depth=0`);
  });
});

describe('ContactsResource.get', () => {
  it('unwraps the single element array', async () => {
    const fetch = createMockFetch({ objects: [{ id: '1' }] });

    const contact = await createResource(fetch).get({ contactId: 1 });

    expect(contact).toEqual({ id: '1' });
    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/Contact/1`);
  });

  it('throws a 404 error when the array is empty', async () => {
    const fetch = createMockFetch({ objects: [] });

    await expect(createResource(fetch).get({ contactId: 1 })).rejects.toThrow(
      SevDeskError,
    );
    await expect(
      createResource(fetch).get({ contactId: 1 }),
    ).rejects.toMatchObject({ status: 404, statusText: 'Not Found' });
  });
});

describe('ContactsResource.create', () => {
  it('injects the boilerplate and builds the category and parent references', async () => {
    const fetch = createMockFetch({ objects: { id: '1' } });

    const contact = await createResource(fetch).create({
      categoryId: 3,
      surename: 'John',
      familyname: 'Snow',
      parentId: 7,
      customerNumber: 'KD-1000',
      status: 1000,
      exemptVat: false,
      defaultTimeToPay: 14,
    });

    expect(contact).toEqual({ id: '1' });
    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Contact`);
    expect(init.method).toBe('POST');
    expect(parsedBody(fetch)).toEqual({
      objectName: 'Contact',
      mapAll: true,
      category: { id: 3, objectName: 'Category' },
      parent: { id: 7, objectName: 'Contact' },
      surename: 'John',
      familyname: 'Snow',
      customerNumber: 'KD-1000',
      status: 1000,
      exemptVat: false,
      defaultTimeToPay: 14,
    });
  });

  it('omits the parent reference when no parent id is given', async () => {
    const fetch = createMockFetch({ objects: { id: '1' } });

    await createResource(fetch).create({ categoryId: 2, name: 'Iron Bank' });

    expect(parsedBody(fetch)).toEqual({
      objectName: 'Contact',
      mapAll: true,
      category: { id: 2, objectName: 'Category' },
      name: 'Iron Bank',
    });
  });
});

describe('ContactsResource.update', () => {
  it('excludes the contact id from the body and keeps the boilerplate', async () => {
    const fetch = createMockFetch({ objects: { id: '1' } });

    await createResource(fetch).update({
      contactId: 1,
      name: 'Iron Bank',
      taxNumber: '151/815/08155',
    });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Contact/1`);
    expect(init.method).toBe('PUT');
    expect(parsedBody(fetch)).toEqual({
      objectName: 'Contact',
      mapAll: true,
      name: 'Iron Bank',
      taxNumber: '151/815/08155',
    });
  });
});

describe('ContactsResource.delete', () => {
  it('deletes the contact and returns nothing', async () => {
    const fetch = createMockFetch({ objects: [] });

    await expect(
      createResource(fetch).delete({ contactId: 1 }),
    ).resolves.toBeUndefined();

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Contact/1`);
    expect(init.method).toBe('DELETE');
  });
});

describe('ContactsResource.getNextCustomerNumber', () => {
  it('returns the unwrapped customer number', async () => {
    const fetch = createMockFetch({ objects: 'KD-1001' });

    const result = await createResource(fetch).getNextCustomerNumber();

    expect(result).toBe('KD-1001');
    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Contact/Factory/getNextCustomerNumber`,
    );
  });
});

describe('ContactsResource.findByCustomFieldValue', () => {
  it('sends the value and the custom field name', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).findByCustomFieldValue({
      value: 'Winterfell',
      customFieldName: 'Castle',
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Contact/Factory/findContactsByCustomFieldValue` +
        '?value=Winterfell&customFieldName=Castle',
    );
  });

  it('adds the bracket filter when a custom field setting id is given', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).findByCustomFieldValue({
      value: 'Winterfell',
      customFieldName: 'Castle',
      customFieldSettingId: 5,
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Contact/Factory/findContactsByCustomFieldValue` +
        '?value=Winterfell&customFieldName=Castle' +
        '&customFieldSetting%5Bid%5D=5' +
        '&customFieldSetting%5BobjectName%5D=ContactCustomFieldSetting',
    );
  });
});

describe('ContactsResource.checkCustomerNumberAvailability', () => {
  it('returns the unwrapped boolean', async () => {
    const fetch = createMockFetch({ objects: false });

    const result = await createResource(fetch).checkCustomerNumberAvailability({
      customerNumber: 'KD-1000',
    });

    expect(result).toBe(false);
    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Contact/Mapper/checkCustomerNumberAvailability?customerNumber=KD-1000`,
    );
  });
});

describe('ContactsResource.getTabsItemCount', () => {
  it('returns the counts without an object envelope', async () => {
    const fetch = createMockFetch({ invoices: 3, orders: 1, parts: '0' });

    const result = await createResource(fetch).getTabsItemCount({
      contactId: 1,
    });

    expect(result).toEqual({ invoices: 3, orders: 1, parts: '0' });
    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Contact/1/getTabsItemCount`,
    );
  });
});
