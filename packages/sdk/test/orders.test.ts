import { describe, expect, it } from 'vitest';
import { SevDeskError } from '../src/errors';
import { OrdersResource } from '../src/resources/orders';
import { createHttpClient, createMockFetch, lastRequest } from './helpers';

const BASE_URL = 'https://my.sevdesk.de/api/v1';

function createResource(fetch: typeof globalThis.fetch): OrdersResource {
  return new OrdersResource(createHttpClient(fetch));
}

function parsedBody(
  fetch: ReturnType<typeof createMockFetch>,
): Record<string, unknown> {
  return JSON.parse(lastRequest(fetch).init.body as string) as Record<
    string,
    unknown
  >;
}

describe('OrdersResource.list', () => {
  it('requests orders without filters', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).list();

    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/Order`);
    expect(lastRequest(fetch).init.method).toBe('GET');
  });

  it('serializes all filters including the bracket contact filter', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).list({
      status: 500,
      orderNumber: 'AN-1000',
      startDate: '01.01.2024',
      endDate: new Date('2024-07-01T00:00:00Z'),
      contactId: 42,
      limit: 10,
      offset: 20,
      embed: ['contact', 'contactPerson'],
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Order?status=500&orderNumber=AN-1000` +
        '&startDate=01.01.2024&endDate=1719792000' +
        '&contact%5Bid%5D=42&contact%5BobjectName%5D=Contact' +
        '&limit=10&offset=20&embed=contact%2CcontactPerson',
    );
  });

  it('omits the contact object name when no contact id is given', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).list({ status: 100 });

    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/Order?status=100`);
  });
});

describe('OrdersResource.get', () => {
  it('unwraps the single element array', async () => {
    const fetch = createMockFetch({ objects: [{ id: '1' }] });

    const order = await createResource(fetch).get({ orderId: 1 });

    expect(order).toEqual({ id: '1' });
    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/Order/1`);
  });

  it('serializes the embed fields', async () => {
    const fetch = createMockFetch({ objects: [{ id: '1' }] });

    await createResource(fetch).get({ orderId: 1, embed: ['contact'] });

    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/Order/1?embed=contact`);
  });

  it('throws a 404 error when the array is empty', async () => {
    const fetch = createMockFetch({ objects: [] });

    await expect(createResource(fetch).get({ orderId: 1 })).rejects.toThrow(
      SevDeskError,
    );
    await expect(
      createResource(fetch).get({ orderId: 1 }),
    ).rejects.toMatchObject({ status: 404, statusText: 'Not Found' });
  });
});

describe('OrdersResource.save', () => {
  const savePayload = {
    objects: { order: { id: '1' }, orderPos: [{ id: '2' }] },
  };

  it('injects the boilerplate and keeps the required body key order', async () => {
    const fetch = createMockFetch(savePayload);

    const result = await createResource(fetch).save({
      order: {
        orderNumber: 'AN-1000',
        orderDate: '01.03.2024',
        contactId: 42,
        status: 100,
        orderType: 'AN',
        header: 'My AN-1000',
        version: 0,
        addressCountryId: 1,
        contactPersonId: 7,
        taxRuleId: 1,
        taxRate: 0,
        taxText: 'Umsatzsteuer 19%',
        currency: 'EUR',
        smallSettlement: false,
      },
      positions: [
        {
          unityId: 1,
          quantity: 2,
          taxRate: 19,
          name: 'Dragonglass',
          price: 100,
          positionNumber: 0,
        },
      ],
    });

    expect(result).toEqual({ order: { id: '1' }, positions: [{ id: '2' }] });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Order/Factory/saveOrder`);
    expect(init.method).toBe('POST');

    const body = parsedBody(fetch);
    expect(Object.keys(body)).toEqual([
      'order',
      'orderPosSave',
      'orderPosDelete',
    ]);
    expect(body.orderPosDelete).toBeNull();
    expect(body.order).toEqual({
      objectName: 'Order',
      mapAll: true,
      orderNumber: 'AN-1000',
      orderDate: '01.03.2024',
      contact: { id: 42, objectName: 'Contact' },
      status: 100,
      orderType: 'AN',
      header: 'My AN-1000',
      version: 0,
      addressCountry: { id: 1, objectName: 'StaticCountry' },
      contactPerson: { id: 7, objectName: 'SevUser' },
      taxRule: { id: 1, objectName: 'TaxRule' },
      taxRate: 0,
      taxText: 'Umsatzsteuer 19%',
      currency: 'EUR',
      smallSettlement: false,
    });
    expect(body.orderPosSave).toEqual([
      {
        objectName: 'OrderPos',
        mapAll: true,
        unity: { id: 1, objectName: 'Unity' },
        quantity: 2,
        taxRate: 19,
        name: 'Dragonglass',
        price: 100,
        positionNumber: 0,
      },
    ]);
  });

  it('serializes date inputs and omits optional position references', async () => {
    const fetch = createMockFetch(savePayload);

    await createResource(fetch).save({
      order: {
        orderNumber: 'LI-1000',
        orderDate: new Date('2024-07-01T00:00:00Z'),
        contactId: 42,
        status: 200,
        orderType: 'LI',
        header: 'My LI-1000',
        version: 1,
        addressCountryId: 1,
        contactPersonId: 7,
        taxRuleId: 1,
        taxRate: 0,
        taxText: 'Umsatzsteuer 19%',
        currency: 'EUR',
        sendType: 'VPDF',
        sendDate: '01.07.2024',
      },
      positions: [{ unityId: 1, quantity: 1, taxRate: 19 }],
    });

    const body = parsedBody(fetch);
    expect(body.order).toMatchObject({
      orderDate: 1719792000,
      sendDate: '01.07.2024',
      sendType: 'VPDF',
      orderType: 'LI',
      version: 1,
    });
    expect(body.orderPosSave).toEqual([
      {
        objectName: 'OrderPos',
        mapAll: true,
        unity: { id: 1, objectName: 'Unity' },
        quantity: 1,
        taxRate: 19,
      },
    ]);
  });
});

describe('OrdersResource.update', () => {
  it('sends only the given fields and serializes the order date', async () => {
    const fetch = createMockFetch({ objects: { id: '1' } });

    await createResource(fetch).update({
      orderId: 1,
      header: 'My AN-1001',
      orderDate: new Date('2024-07-01T00:00:00Z'),
    });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Order/1`);
    expect(init.method).toBe('PUT');
    expect(parsedBody(fetch)).toEqual({
      header: 'My AN-1001',
      orderDate: 1719792000,
    });
  });
});

describe('OrdersResource.delete', () => {
  it('deletes an order and returns nothing', async () => {
    const fetch = createMockFetch({ objects: [] });

    await expect(
      createResource(fetch).delete({ orderId: 1 }),
    ).resolves.toBeUndefined();

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Order/1`);
    expect(init.method).toBe('DELETE');
  });
});

describe('OrdersResource sub resources', () => {
  it('retrieves the positions of an order', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).getPositions({
      orderId: 1,
      limit: 5,
      offset: 10,
      embed: ['part'],
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Order/1/getPositions?limit=5&offset=10&embed=part`,
    );
  });

  it('retrieves the discounts of an order', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).getDiscounts({ orderId: 1 });

    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/Order/1/getDiscounts`);
  });

  it('retrieves the related objects of an order', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).getRelatedObjects({
      orderId: 1,
      includeItself: true,
      sortByType: false,
      embed: ['contact'],
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Order/1/getRelatedObjects` +
        '?includeItself=1&sortByType=0&embed=contact',
    );
  });
});

describe('OrdersResource.sendViaEmail', () => {
  it('sends the mail data without the order id', async () => {
    const fetch = createMockFetch({ objects: [{ id: '1' }] });

    await createResource(fetch).sendViaEmail({
      orderId: 1,
      toEmail: 'customer@example.com',
      subject: 'Your order',
      text: '<p>Thanks</p>',
      ccEmail: 'copy@example.com',
    });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Order/1/sendViaEmail`);
    expect(init.method).toBe('POST');
    expect(parsedBody(fetch)).toEqual({
      toEmail: 'customer@example.com',
      subject: 'Your order',
      text: '<p>Thanks</p>',
      ccEmail: 'copy@example.com',
    });
  });
});

describe('OrdersResource factories', () => {
  it('creates a packing list with the order reference in query and body', async () => {
    const fetch = createMockFetch({ objects: { id: '2' } });

    await createResource(fetch).createPackingList({ orderId: 1 });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(
      `${BASE_URL}/Order/Factory/createPackingListFromOrder` +
        '?order%5Bid%5D=1&order%5BobjectName%5D=Order',
    );
    expect(init.method).toBe('POST');
    expect(parsedBody(fetch)).toEqual({ id: 1, objectName: 'Order' });
  });

  it('creates a contract note with the order reference in query and body', async () => {
    const fetch = createMockFetch({ objects: { id: '2' } });

    await createResource(fetch).createContractNote({ orderId: 1 });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Order/Factory/createContractNoteFromOrder` +
        '?order%5Bid%5D=1&order%5BobjectName%5D=Order',
    );
    expect(parsedBody(fetch)).toEqual({ id: 1, objectName: 'Order' });
  });
});

describe('OrdersResource.getPdf', () => {
  it('passes the prevent send by flag and returns the unwrapped payload', async () => {
    const fetch = createMockFetch({
      filename: 'AN-1001.pdf',
      mimeType: 'application/pdf',
      base64encoded: true,
      content: 'JVBER',
    });

    const pdf = await createResource(fetch).getPdf({
      orderId: 1,
      preventSendBy: true,
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Order/1/getPdf?preventSendBy=1`,
    );
    expect(pdf.content).toBe('JVBER');
  });
});

describe('OrdersResource.sendBy', () => {
  it('sends the send type and the draft flag', async () => {
    const fetch = createMockFetch({ objects: { id: '1' } });

    await createResource(fetch).sendBy({
      orderId: 1,
      sendType: 'VM',
      sendDraft: false,
    });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Order/1/sendBy`);
    expect(init.method).toBe('PUT');
    expect(parsedBody(fetch)).toEqual({ sendType: 'VM', sendDraft: false });
  });
});

describe('OrdersResource positions', () => {
  it('filters positions by the order reference', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).listPositions({ orderId: 1, limit: 5 });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/OrderPos?order%5Bid%5D=1&order%5BobjectName%5D=Order&limit=5`,
    );
  });

  it('requests all positions without filters', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).listPositions();

    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/OrderPos`);
  });

  it('unwraps a single position', async () => {
    const fetch = createMockFetch({ objects: [{ id: '2' }] });

    const position = await createResource(fetch).getPosition({ orderPosId: 2 });

    expect(position).toEqual({ id: '2' });
    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/OrderPos/2`);
  });

  it('throws a 404 error when the position array is empty', async () => {
    const fetch = createMockFetch({ objects: [] });

    await expect(
      createResource(fetch).getPosition({ orderPosId: 2 }),
    ).rejects.toMatchObject({ status: 404, statusText: 'Not Found' });
  });

  it('builds the references when updating a position', async () => {
    const fetch = createMockFetch({ objects: { id: '2' } });

    await createResource(fetch).updatePosition({
      orderPosId: 2,
      quantity: 3,
      price: 50,
      unityId: 1,
      partId: 5,
    });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/OrderPos/2`);
    expect(init.method).toBe('PUT');
    expect(parsedBody(fetch)).toEqual({
      quantity: 3,
      price: 50,
      unity: { id: 1, objectName: 'Unity' },
      part: { id: 5, objectName: 'Part' },
    });
  });

  it('omits the references when updating without them', async () => {
    const fetch = createMockFetch({ objects: { id: '2' } });

    await createResource(fetch).updatePosition({ orderPosId: 2, taxRate: 7 });

    expect(parsedBody(fetch)).toEqual({ taxRate: 7 });
  });

  it('deletes a position and returns nothing', async () => {
    const fetch = createMockFetch({ objects: [] });

    await expect(
      createResource(fetch).deletePosition({ orderPosId: 2 }),
    ).resolves.toBeUndefined();

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/OrderPos/2`);
    expect(init.method).toBe('DELETE');
  });
});
