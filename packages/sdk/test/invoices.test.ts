import { describe, expect, it } from 'vitest';
import { SevDeskError } from '../src/errors';
import { InvoicesResource } from '../src/resources/invoices';
import { createHttpClient, createMockFetch, lastRequest } from './helpers';

const BASE_URL = 'https://my.sevdesk.de/api/v1';

function createResource(fetch: typeof globalThis.fetch): InvoicesResource {
  return new InvoicesResource(createHttpClient(fetch));
}

function parsedBody(
  fetch: ReturnType<typeof createMockFetch>,
): Record<string, unknown> {
  return JSON.parse(lastRequest(fetch).init.body as string) as Record<
    string,
    unknown
  >;
}

describe('InvoicesResource.list', () => {
  it('requests invoices without filters', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).list();

    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/Invoice`);
    expect(lastRequest(fetch).init.method).toBe('GET');
  });

  it('serializes all filters including the bracket contact filter', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).list({
      status: 200,
      invoiceNumber: 'RE-1000',
      startDate: '01.01.2024',
      endDate: new Date('2024-07-01T00:00:00Z'),
      contactId: 42,
      limit: 10,
      offset: 20,
      embed: ['contact', 'contactPerson'],
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Invoice?status=200&invoiceNumber=RE-1000` +
        '&startDate=01.01.2024&endDate=1719792000' +
        '&contact%5Bid%5D=42&contact%5BobjectName%5D=Contact' +
        '&limit=10&offset=20&embed=contact%2CcontactPerson',
    );
  });

  it('omits the contact object name when no contact id is given', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).list({ status: 100 });

    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/Invoice?status=100`);
  });
});

describe('InvoicesResource.get', () => {
  it('unwraps the single element array', async () => {
    const fetch = createMockFetch({ objects: [{ id: '1' }] });

    const invoice = await createResource(fetch).get({ invoiceId: 1 });

    expect(invoice).toEqual({ id: '1' });
    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/Invoice/1`);
  });

  it('serializes the embed fields', async () => {
    const fetch = createMockFetch({ objects: [{ id: '1' }] });

    await createResource(fetch).get({ invoiceId: 1, embed: ['contact'] });

    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/Invoice/1?embed=contact`);
  });

  it('throws a 404 error when the array is empty', async () => {
    const fetch = createMockFetch({ objects: [] });

    await expect(createResource(fetch).get({ invoiceId: 1 })).rejects.toThrow(
      SevDeskError,
    );
    await expect(
      createResource(fetch).get({ invoiceId: 1 }),
    ).rejects.toMatchObject({ status: 404, statusText: 'Not Found' });
  });
});

describe('InvoicesResource.save', () => {
  const savePayload = {
    objects: { invoice: { id: '1' }, invoicePos: [{ id: '2' }] },
  };

  it('injects the boilerplate and keeps the required body key order', async () => {
    const fetch = createMockFetch(savePayload);

    const result = await createResource(fetch).save({
      invoice: {
        status: 100,
        invoiceDate: '01.03.2024',
        contactId: 42,
        contactPersonId: 7,
        invoiceType: 'RE',
        currency: 'EUR',
        taxRuleId: 1,
        taxText: 'Umsatzsteuer 19%',
        addressCountryId: 1,
        paymentMethodId: 3,
      },
      positions: [
        {
          quantity: 2,
          taxRate: 19,
          unityId: 1,
          name: 'Dragonglass',
          price: 100,
          partId: 5,
        },
      ],
    });

    expect(result).toEqual({ invoice: { id: '1' }, positions: [{ id: '2' }] });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Invoice/Factory/saveInvoice`);
    expect(init.method).toBe('POST');

    const body = parsedBody(fetch);
    expect(Object.keys(body)).toEqual([
      'invoice',
      'invoicePosSave',
      'invoicePosDelete',
      'discountSave',
      'discountDelete',
    ]);
    expect(body.invoicePosDelete).toBeNull();
    expect(body.discountSave).toBeNull();
    expect(body.discountDelete).toBeNull();
    expect(body.invoice).toEqual({
      objectName: 'Invoice',
      mapAll: true,
      contact: { id: 42, objectName: 'Contact' },
      contactPerson: { id: 7, objectName: 'SevUser' },
      invoiceDate: '01.03.2024',
      discount: 0,
      addressCountry: { id: 1, objectName: 'StaticCountry' },
      status: 100,
      taxRate: 0,
      taxRule: { id: 1, objectName: 'TaxRule' },
      taxText: 'Umsatzsteuer 19%',
      paymentMethod: { id: 3, objectName: 'PaymentMethod' },
      invoiceType: 'RE',
      currency: 'EUR',
    });
    expect(body.invoicePosSave).toEqual([
      {
        objectName: 'InvoicePos',
        mapAll: true,
        invoice: null,
        part: { id: 5, objectName: 'Part' },
        quantity: 2,
        price: 100,
        name: 'Dragonglass',
        unity: { id: 1, objectName: 'Unity' },
        taxRate: 19,
      },
    ]);
  });

  it('serializes dates and appends the default address flag last', async () => {
    const fetch = createMockFetch(savePayload);

    await createResource(fetch).save({
      invoice: {
        status: 100,
        invoiceDate: new Date('2024-07-01T00:00:00Z'),
        contactId: 42,
        contactPersonId: 7,
        invoiceType: 'AR',
        currency: 'EUR',
        taxRuleId: 11,
        taxText: 'Steuer nicht erhoben nach §19 UStG',
        deliveryDate: '01.07.2024',
        discount: 3,
        showNet: true,
      },
      positions: [{ quantity: 1, taxRate: 0, unityId: 1 }],
      takeDefaultAddress: true,
    });

    const body = parsedBody(fetch);
    expect(Object.keys(body)).toEqual([
      'invoice',
      'invoicePosSave',
      'invoicePosDelete',
      'discountSave',
      'discountDelete',
      'takeDefaultAddress',
    ]);
    expect(body.invoice).toMatchObject({
      invoiceDate: 1719792000,
      deliveryDate: '01.07.2024',
      discount: 3,
      showNet: true,
      invoiceType: 'AR',
    });
    expect(body.invoicePosSave).toEqual([
      {
        objectName: 'InvoicePos',
        mapAll: true,
        invoice: null,
        quantity: 1,
        unity: { id: 1, objectName: 'Unity' },
        taxRate: 0,
      },
    ]);
  });
});

describe('InvoicesResource.createFromOrder', () => {
  it('builds the order reference and passes the amount parameters', async () => {
    const fetch = createMockFetch({ objects: { id: '1' } });

    await createResource(fetch).createFromOrder({
      orderId: 9,
      type: 'percentage',
      amount: 50,
      partialType: 'TR',
    });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Invoice/Factory/createInvoiceFromOrder`);
    expect(init.method).toBe('POST');
    expect(parsedBody(fetch)).toEqual({
      order: { id: 9, objectName: 'Order' },
      type: 'percentage',
      amount: 50,
      partialType: 'TR',
    });
  });

  it('sends only the order reference by default', async () => {
    const fetch = createMockFetch({ objects: { id: '1' } });

    await createResource(fetch).createFromOrder({ orderId: 9 });

    expect(parsedBody(fetch)).toEqual({
      order: { id: 9, objectName: 'Order' },
    });
  });
});

describe('InvoicesResource.createReminder', () => {
  it('sends the invoice reference', async () => {
    const fetch = createMockFetch({ objects: { id: '2' } });

    await createResource(fetch).createReminder({ invoiceId: 1 });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Invoice/Factory/createInvoiceReminder`);
    expect(init.method).toBe('POST');
    expect(parsedBody(fetch)).toEqual({
      invoice: { id: 1, objectName: 'Invoice' },
    });
  });
});

describe('InvoicesResource.getPositions', () => {
  it('requests the positions of an invoice with pagination', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).getPositions({
      invoiceId: 1,
      limit: 5,
      offset: 10,
      embed: ['part'],
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Invoice/1/getPositions?limit=5&offset=10&embed=part`,
    );
  });
});

describe('InvoicesResource.isPartiallyPaid', () => {
  it('unwraps the boolean payload', async () => {
    const fetch = createMockFetch({ objects: false });

    const result = await createResource(fetch).isPartiallyPaid({
      invoiceId: 1,
    });

    expect(result).toBe(false);
    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Invoice/1/getIsPartiallyPaid`,
    );
  });
});

describe('InvoicesResource.cancel', () => {
  it('posts to the cancel endpoint without a body', async () => {
    const fetch = createMockFetch({ objects: { id: '2', invoiceType: 'SR' } });

    const invoice = await createResource(fetch).cancel({ invoiceId: 1 });

    expect(invoice).toEqual({ id: '2', invoiceType: 'SR' });
    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Invoice/1/cancelInvoice`);
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
  });
});

describe('InvoicesResource.render', () => {
  it('forces a re-render when requested', async () => {
    const fetch = createMockFetch({ objects: { pages: 1 } });

    await createResource(fetch).render({ invoiceId: 1, forceReload: true });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Invoice/1/render`);
    expect(init.method).toBe('POST');
    expect(parsedBody(fetch)).toEqual({ forceReload: true });
  });

  it('sends an empty body by default', async () => {
    const fetch = createMockFetch({ objects: { pages: 1 } });

    await createResource(fetch).render({ invoiceId: 1 });

    expect(parsedBody(fetch)).toEqual({});
  });
});

describe('InvoicesResource.sendViaEmail', () => {
  it('sends the mail data without the invoice id', async () => {
    const fetch = createMockFetch({ objects: { id: '5' } });

    await createResource(fetch).sendViaEmail({
      invoiceId: 1,
      toEmail: 'customer@example.com',
      subject: 'Your invoice',
      text: '<p>Thanks</p>',
      copy: true,
      additionalAttachments: '3,4',
      ccEmail: 'cc@example.com',
      bccEmail: 'bcc@example.com',
      sendXml: false,
    });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Invoice/1/sendViaEmail`);
    expect(init.method).toBe('POST');
    expect(parsedBody(fetch)).toEqual({
      toEmail: 'customer@example.com',
      subject: 'Your invoice',
      text: '<p>Thanks</p>',
      copy: true,
      additionalAttachments: '3,4',
      ccEmail: 'cc@example.com',
      bccEmail: 'bcc@example.com',
      sendXml: false,
    });
  });

  it('sends only the required mail fields', async () => {
    const fetch = createMockFetch({ objects: { id: '5' } });

    await createResource(fetch).sendViaEmail({
      invoiceId: 1,
      toEmail: 'customer@example.com',
      subject: 'Your invoice',
      text: 'Thanks',
    });

    expect(parsedBody(fetch)).toEqual({
      toEmail: 'customer@example.com',
      subject: 'Your invoice',
      text: 'Thanks',
    });
  });
});

describe('InvoicesResource.getPdf', () => {
  it('passes the prevent send by flag', async () => {
    const fetch = createMockFetch({
      objects: { filename: 'RE-1000.pdf', base64encoded: true },
    });

    const pdf = await createResource(fetch).getPdf({
      invoiceId: 1,
      preventSendBy: true,
    });

    expect(pdf.filename).toBe('RE-1000.pdf');
    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Invoice/1/getPdf?preventSendBy=1`,
    );
  });

  it('omits the query when no flag is given', async () => {
    const fetch = createMockFetch({ objects: { filename: 'RE-1000.pdf' } });

    await createResource(fetch).getPdf({ invoiceId: 1 });

    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/Invoice/1/getPdf`);
  });
});

describe('InvoicesResource.getXml', () => {
  it('returns the unwrapped xml string', async () => {
    const fetch = createMockFetch({ objects: '<?xml version="1.0"?>' });

    const xml = await createResource(fetch).getXml({ invoiceId: 1 });

    expect(xml).toBe('<?xml version="1.0"?>');
    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/Invoice/1/getXml`);
  });
});

describe('InvoicesResource.sendBy', () => {
  it('sends the send type and the draft flag', async () => {
    const fetch = createMockFetch({ objects: { id: '1' } });

    await createResource(fetch).sendBy({
      invoiceId: 1,
      sendType: 'VPDF',
      sendDraft: true,
    });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Invoice/1/sendBy`);
    expect(init.method).toBe('PUT');
    expect(parsedBody(fetch)).toEqual({ sendType: 'VPDF', sendDraft: true });
  });

  it('omits the draft flag by default', async () => {
    const fetch = createMockFetch({ objects: { id: '1' } });

    await createResource(fetch).sendBy({ invoiceId: 1, sendType: 'VM' });

    expect(parsedBody(fetch)).toEqual({ sendType: 'VM' });
  });
});

describe('InvoicesResource.book', () => {
  it('builds the check account reference and omits the transaction by default', async () => {
    const fetch = createMockFetch({ objects: { id: '9' } });

    await createResource(fetch).book({
      invoiceId: 1,
      amount: 119,
      date: new Date('2024-07-01T00:00:00Z'),
      type: 'FULL_PAYMENT',
      checkAccountId: 3,
    });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Invoice/1/bookAmount`);
    expect(init.method).toBe('PUT');
    expect(parsedBody(fetch)).toEqual({
      amount: 119,
      date: '2024-07-01T00:00:00.000Z',
      type: 'FULL_PAYMENT',
      checkAccount: { id: 3, objectName: 'CheckAccount' },
    });
  });

  it('includes the transaction reference and the feed flag when given', async () => {
    const fetch = createMockFetch({ objects: { id: '9' } });

    await createResource(fetch).book({
      invoiceId: 1,
      amount: 50,
      date: '2024-07-01T00:00:00.000Z',
      type: 'CB',
      checkAccountId: 3,
      checkAccountTransactionId: 77,
      createFeed: false,
    });

    expect(parsedBody(fetch)).toEqual({
      amount: 50,
      date: '2024-07-01T00:00:00.000Z',
      type: 'CB',
      checkAccount: { id: 3, objectName: 'CheckAccount' },
      checkAccountTransaction: {
        id: 77,
        objectName: 'CheckAccountTransaction',
      },
      createFeed: false,
    });
  });
});

describe('InvoicesResource status transitions', () => {
  it('enshrines an invoice and returns nothing', async () => {
    const fetch = createMockFetch({ objects: null });

    await expect(
      createResource(fetch).enshrine({ invoiceId: 1 }),
    ).resolves.toBeUndefined();

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Invoice/1/enshrine`);
    expect(init.method).toBe('PUT');
    expect(init.body).toBeUndefined();
  });

  it('resets an invoice to open', async () => {
    const fetch = createMockFetch({ objects: { id: '1', status: '200' } });

    await createResource(fetch).resetToOpen({ invoiceId: 1 });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Invoice/1/resetToOpen`);
    expect(init.method).toBe('PUT');
  });

  it('resets an invoice to draft', async () => {
    const fetch = createMockFetch({ objects: { id: '1', status: '100' } });

    await createResource(fetch).resetToDraft({ invoiceId: 1 });

    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/Invoice/1/resetToDraft`);
  });
});
