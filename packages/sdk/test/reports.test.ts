import { describe, expect, it } from 'vitest';
import { ReportsResource } from '../src/resources/reports';
import { createHttpClient, createMockFetch, lastRequest } from './helpers';

const BASE_URL = 'https://my.sevdesk.de/api/v1';

const reportFile = {
  filename: 'invoice.pdf',
  mimetype: 'application/pdf',
  base64Encoded: true,
  content: 'JVBERi0xLjQ=',
};

function createResource(fetch: typeof globalThis.fetch): ReportsResource {
  return new ReportsResource(createHttpClient(fetch));
}

describe('ReportsResource.invoiceList', () => {
  it('defaults the view to all', async () => {
    const fetch = createMockFetch({ objects: reportFile });

    const result = await createResource(fetch).invoiceList();

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(
      `${BASE_URL}/Report/invoicelist?view=all` +
        '&sevQuery%5BobjectName%5D=SevQuery&sevQuery%5BmodelName%5D=Invoice',
    );
    expect(init.method).toBe('GET');
    expect(result).toEqual(reportFile);
  });

  it('flattens the download flag, the view, the limit and the filters', async () => {
    const fetch = createMockFetch({ objects: reportFile });

    await createResource(fetch).invoiceList({
      download: true,
      view: 'open',
      limit: 1000,
      filter: {
        invoiceType: ['RE'],
        startDate: new Date('2024-01-01T00:00:00Z'),
        contactId: 42,
        startAmount: 100,
        endAmount: 150,
      },
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Report/invoicelist?download=true&view=open` +
        '&sevQuery%5BobjectName%5D=SevQuery&sevQuery%5BmodelName%5D=Invoice' +
        '&sevQuery%5Blimit%5D=1000' +
        '&sevQuery%5Bfilter%5D%5BstartDate%5D=2024-01-01T00%3A00%3A00.000Z' +
        '&sevQuery%5Bfilter%5D%5Bcontact%5D%5Bid%5D=42' +
        '&sevQuery%5Bfilter%5D%5Bcontact%5D%5BobjectName%5D=Contact' +
        '&sevQuery%5Bfilter%5D%5BstartAmount%5D=100' +
        '&sevQuery%5Bfilter%5D%5BendAmount%5D=150' +
        '&sevQuery%5Bfilter%5D%5BinvoiceType%5D%5B0%5D=RE',
    );
  });
});

describe('ReportsResource.orderList', () => {
  it('sends the order type filter', async () => {
    const fetch = createMockFetch({ objects: reportFile });

    await createResource(fetch).orderList({
      filter: { orderType: 'AN', endDate: '2024-12-31T23:59:59Z' },
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Report/orderlist?view=all` +
        '&sevQuery%5BobjectName%5D=SevQuery&sevQuery%5BmodelName%5D=Order' +
        '&sevQuery%5Bfilter%5D%5BendDate%5D=2024-12-31T23%3A59%3A59Z' +
        '&sevQuery%5Bfilter%5D%5BorderType%5D=AN',
    );
  });
});

describe('ReportsResource.contactList', () => {
  it('sends the contact filters without a view', async () => {
    const fetch = createMockFetch({ objects: reportFile });

    await createResource(fetch).contactList({
      download: false,
      limit: 100,
      filter: { city: 'Offenburg', countryId: 1, onlyPeople: true },
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Report/contactlist?download=false` +
        '&sevQuery%5BobjectName%5D=SevQuery&sevQuery%5BmodelName%5D=Contact' +
        '&sevQuery%5Blimit%5D=100' +
        '&sevQuery%5Bfilter%5D%5Bcity%5D=Offenburg' +
        '&sevQuery%5Bfilter%5D%5Bcountry%5D%5Bid%5D=1' +
        '&sevQuery%5Bfilter%5D%5Bcountry%5D%5BobjectName%5D=StaticCountry' +
        '&sevQuery%5Bfilter%5D%5BonlyPeople%5D=true',
    );
  });
});

describe('ReportsResource.voucherList', () => {
  it('sends the voucher pay date filters without a view', async () => {
    const fetch = createMockFetch({ objects: reportFile });

    await createResource(fetch).voucherList({
      filter: { startPayDate: new Date('2024-02-01T00:00:00Z') },
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Report/voucherlist` +
        '?sevQuery%5BobjectName%5D=SevQuery&sevQuery%5BmodelName%5D=Voucher' +
        '&sevQuery%5Bfilter%5D%5BstartPayDate%5D=2024-02-01T00%3A00%3A00.000Z',
    );
  });
});
