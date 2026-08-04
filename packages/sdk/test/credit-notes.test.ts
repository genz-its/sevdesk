import { describe, expect, it } from 'vitest';
import { SevDeskError } from '../src/errors';
import { CreditNotesResource } from '../src/resources/credit-notes';
import { createHttpClient, createMockFetch, lastRequest } from './helpers';

const BASE_URL = 'https://my.sevdesk.de/api/v1';

function createResource(fetch: typeof globalThis.fetch): CreditNotesResource {
  return new CreditNotesResource(createHttpClient(fetch));
}

function parsedBody(
  fetch: ReturnType<typeof createMockFetch>,
): Record<string, unknown> {
  return JSON.parse(lastRequest(fetch).init.body as string) as Record<
    string,
    unknown
  >;
}

describe('CreditNotesResource.list', () => {
  it('requests credit notes without filters', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).list();

    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/CreditNote`);
    expect(lastRequest(fetch).init.method).toBe('GET');
  });

  it('serializes all filters including the bracket contact filter', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).list({
      status: 200,
      creditNoteNumber: 'GU-1000',
      startDate: '01.01.2024',
      endDate: new Date('2024-07-01T00:00:00Z'),
      contactId: 42,
      limit: 10,
      offset: 20,
      embed: ['contact', 'contactPerson'],
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/CreditNote?status=200&creditNoteNumber=GU-1000` +
        '&startDate=01.01.2024&endDate=1719792000' +
        '&contact%5Bid%5D=42&contact%5BobjectName%5D=Contact' +
        '&limit=10&offset=20&embed=contact%2CcontactPerson',
    );
  });

  it('omits the contact object name when no contact id is given', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).list({ status: 100 });

    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/CreditNote?status=100`);
  });
});

describe('CreditNotesResource.get', () => {
  it('unwraps the single element array', async () => {
    const fetch = createMockFetch({ objects: [{ id: '1' }] });

    const creditNote = await createResource(fetch).get({ creditNoteId: 1 });

    expect(creditNote).toEqual({ id: '1' });
    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/CreditNote/1`);
  });

  it('throws a 404 error when the array is empty', async () => {
    const fetch = createMockFetch({ objects: [] });

    await expect(
      createResource(fetch).get({ creditNoteId: 1 }),
    ).rejects.toThrow(SevDeskError);
    await expect(
      createResource(fetch).get({ creditNoteId: 1 }),
    ).rejects.toMatchObject({ status: 404, statusText: 'Not Found' });
  });
});

describe('CreditNotesResource.save', () => {
  const savePayload = {
    objects: {
      creditNote: { id: '1' },
      creditNotePos: [{ id: '2' }],
    },
  };

  it('injects the boilerplate and keeps the required body key order', async () => {
    const fetch = createMockFetch(savePayload);

    const result = await createResource(fetch).save({
      creditNote: {
        creditNoteNumber: 'GU-1000',
        creditNoteDate: '01.03.2024',
        contactId: 42,
        status: 100,
        header: 'My GU-1000',
        bookingCategory: 'PROVISION',
        contactPersonId: 7,
        taxRuleId: 1,
        taxRate: 0,
        taxText: 'Umsatzsteuer 19%',
        currency: 'EUR',
        deliveryDate: '01.03.2024',
        addressCountryId: 1,
      },
      positions: [
        {
          unityId: 1,
          quantity: 2,
          taxRate: 19,
          name: 'Dragonglass',
          price: 100,
        },
      ],
    });

    expect(result).toEqual({
      creditNote: { id: '1' },
      positions: [{ id: '2' }],
    });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/CreditNote/Factory/saveCreditNote`);
    expect(init.method).toBe('POST');

    const body = parsedBody(fetch);
    expect(Object.keys(body)).toEqual([
      'creditNote',
      'creditNotePosSave',
      'creditNotePosDelete',
      'discountSave',
      'discountDelete',
    ]);
    expect(body.creditNotePosDelete).toBeNull();
    expect(body.discountSave).toBeNull();
    expect(body.discountDelete).toBeNull();
    expect(body.creditNote).toEqual({
      objectName: 'CreditNote',
      mapAll: true,
      creditNoteNumber: 'GU-1000',
      creditNoteDate: '01.03.2024',
      contact: { id: 42, objectName: 'Contact' },
      status: 100,
      header: 'My GU-1000',
      bookingCategory: 'PROVISION',
      contactPerson: { id: 7, objectName: 'SevUser' },
      taxRule: { id: 1, objectName: 'TaxRule' },
      taxRate: 0,
      taxText: 'Umsatzsteuer 19%',
      currency: 'EUR',
      deliveryDate: '01.03.2024',
      addressCountry: { id: 1, objectName: 'StaticCountry' },
    });
    expect(body.creditNotePosSave).toEqual([
      {
        objectName: 'CreditNotePos',
        mapAll: true,
        unity: { id: 1, objectName: 'Unity' },
        quantity: 2,
        taxRate: 19,
        name: 'Dragonglass',
        price: 100,
      },
    ]);
  });

  it('omits optional references that are not given', async () => {
    const fetch = createMockFetch(savePayload);

    await createResource(fetch).save({
      creditNote: {
        creditNoteNumber: 'GU-1001',
        creditNoteDate: new Date('2024-07-01T00:00:00Z'),
        contactId: 42,
        status: 200,
        header: 'My GU-1001',
        bookingCategory: 'UNDERACHIEVEMENT',
        contactPersonId: 7,
        taxRuleId: 1,
        taxRate: 0,
        taxText: 'Umsatzsteuer 19%',
        currency: 'EUR',
        deliveryDate: 1719792000,
        showNet: true,
      },
      positions: [{ unityId: 1, quantity: 1, taxRate: 19, partId: 5 }],
    });

    const body = parsedBody(fetch);
    expect(body.creditNote).toEqual({
      objectName: 'CreditNote',
      mapAll: true,
      creditNoteNumber: 'GU-1001',
      creditNoteDate: 1719792000,
      contact: { id: 42, objectName: 'Contact' },
      status: 200,
      header: 'My GU-1001',
      bookingCategory: 'UNDERACHIEVEMENT',
      contactPerson: { id: 7, objectName: 'SevUser' },
      taxRule: { id: 1, objectName: 'TaxRule' },
      taxRate: 0,
      taxText: 'Umsatzsteuer 19%',
      currency: 'EUR',
      deliveryDate: 1719792000,
      showNet: true,
    });
    expect(body.creditNotePosSave).toEqual([
      {
        objectName: 'CreditNotePos',
        mapAll: true,
        unity: { id: 1, objectName: 'Unity' },
        quantity: 1,
        taxRate: 19,
        part: { id: 5, objectName: 'Part' },
      },
    ]);
  });
});

describe('CreditNotesResource.createFromInvoice', () => {
  it('sends the invoice reference and maps the response', async () => {
    const fetch = createMockFetch({
      objects: {
        creditNote: { id: '1' },
        creditNotePos: [{ id: '2' }],
        discount: [{ id: '3' }],
      },
    });

    const result = await createResource(fetch).createFromInvoice({
      invoiceId: 1234,
    });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/CreditNote/Factory/createFromInvoice`);
    expect(init.method).toBe('POST');
    expect(parsedBody(fetch)).toEqual({
      invoice: { id: 1234, objectName: 'Invoice' },
    });
    expect(result).toEqual({
      creditNote: { id: '1' },
      positions: [{ id: '2' }],
      discounts: [{ id: '3' }],
    });
  });
});

describe('CreditNotesResource.update', () => {
  it('sends only the given fields and serializes the dates', async () => {
    const fetch = createMockFetch({ objects: { id: '1' } });

    await createResource(fetch).update({
      creditNoteId: 1,
      header: 'My GU-1001',
      creditNoteDate: new Date('2024-07-01T00:00:00Z'),
    });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/CreditNote/1`);
    expect(init.method).toBe('PUT');
    expect(parsedBody(fetch)).toEqual({
      header: 'My GU-1001',
      creditNoteDate: 1719792000,
    });
  });
});

describe('CreditNotesResource.delete', () => {
  it('deletes a credit note and returns nothing', async () => {
    const fetch = createMockFetch({ objects: [] });

    await expect(
      createResource(fetch).delete({ creditNoteId: 1 }),
    ).resolves.toBeUndefined();

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/CreditNote/1`);
    expect(init.method).toBe('DELETE');
  });
});

describe('CreditNotesResource.sendViaEmail', () => {
  it('sends the mail data without the credit note id', async () => {
    const fetch = createMockFetch({ objects: [{ id: '1' }] });

    await createResource(fetch).sendViaEmail({
      creditNoteId: 1,
      toEmail: 'customer@example.com',
      subject: 'Your credit note',
      text: '<p>Thanks</p>',
      copy: true,
    });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/CreditNote/1/sendViaEmail`);
    expect(init.method).toBe('POST');
    expect(parsedBody(fetch)).toEqual({
      toEmail: 'customer@example.com',
      subject: 'Your credit note',
      text: '<p>Thanks</p>',
      copy: true,
    });
  });
});

describe('CreditNotesResource.getPdf', () => {
  it('passes the prevent send by flag and returns the unwrapped payload', async () => {
    const fetch = createMockFetch({
      filename: 'GU-1001.pdf',
      mimeType: 'application/pdf',
      base64encoded: true,
      content: 'JVBER',
    });

    const pdf = await createResource(fetch).getPdf({
      creditNoteId: 1,
      preventSendBy: true,
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/CreditNote/1/getPdf?preventSendBy=true`,
    );
    expect(pdf.content).toBe('JVBER');
  });

  it('omits the query when no flag is given', async () => {
    const fetch = createMockFetch({ filename: 'GU-1001.pdf' });

    await createResource(fetch).getPdf({ creditNoteId: 1 });

    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/CreditNote/1/getPdf`);
  });
});

describe('CreditNotesResource.sendBy', () => {
  it('sends the send type and the draft flag', async () => {
    const fetch = createMockFetch({ objects: { id: '1' } });

    await createResource(fetch).sendBy({
      creditNoteId: 1,
      sendType: 'VPDF',
      sendDraft: false,
    });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/CreditNote/1/sendBy`);
    expect(init.method).toBe('PUT');
    expect(parsedBody(fetch)).toEqual({ sendType: 'VPDF', sendDraft: false });
  });
});

describe('CreditNotesResource.book', () => {
  it('builds the check account reference and omits the transaction by default', async () => {
    const fetch = createMockFetch({ objects: { id: '9' } });

    await createResource(fetch).book({
      creditNoteId: 1,
      amount: 119,
      date: new Date('2024-07-01T00:00:00Z'),
      type: 'FULL_PAYMENT',
      checkAccountId: 3,
    });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/CreditNote/1/bookAmount`);
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
      creditNoteId: 1,
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

describe('CreditNotesResource status transitions', () => {
  it('enshrines a credit note and returns nothing', async () => {
    const fetch = createMockFetch({ objects: null });

    await expect(
      createResource(fetch).enshrine({ creditNoteId: 1 }),
    ).resolves.toBeUndefined();

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/CreditNote/1/enshrine`);
    expect(init.method).toBe('PUT');
  });

  it('resets a credit note to open', async () => {
    const fetch = createMockFetch({ objects: { id: '1' } });

    await createResource(fetch).resetToOpen({ creditNoteId: 1 });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/CreditNote/1/resetToOpen`);
    expect(init.method).toBe('PUT');
    expect(init.body).toBeUndefined();
  });

  it('resets a credit note to draft', async () => {
    const fetch = createMockFetch({ objects: { id: '1' } });

    await createResource(fetch).resetToDraft({ creditNoteId: 1 });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/CreditNote/1/resetToDraft`,
    );
  });
});

describe('CreditNotesResource.listPositions', () => {
  it('filters by the credit note reference', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).listPositions({ creditNoteId: 1, limit: 5 });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/CreditNotePos?creditNote%5Bid%5D=1` +
        '&creditNote%5BobjectName%5D=CreditNote&limit=5',
    );
  });

  it('requests all positions without filters', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).listPositions();

    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/CreditNotePos`);
  });
});
