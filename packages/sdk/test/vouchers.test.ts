import { describe, expect, it, vi } from 'vitest';
import { SevDeskError } from '../src/errors';
import { VouchersResource } from '../src/resources/vouchers';
import { createHttpClient, createMockFetch, lastRequest } from './helpers';

const BASE_URL = 'https://my.sevdesk.de/api/v1';

function createResource(fetch: typeof globalThis.fetch): VouchersResource {
  return new VouchersResource(createHttpClient(fetch));
}

function rawBody(fetch: ReturnType<typeof vi.fn>): string {
  return lastRequest(fetch).init.body as string;
}

function parsedBody(fetch: ReturnType<typeof vi.fn>): Record<string, unknown> {
  return JSON.parse(rawBody(fetch)) as Record<string, unknown>;
}

describe('VouchersResource.list', () => {
  it('requests vouchers without filters', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).list();

    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/Voucher`);
    expect(lastRequest(fetch).init.method).toBe('GET');
  });

  it('serializes all filters including the bracket contact filter', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).list({
      status: 100,
      creditDebit: 'D',
      descriptionLike: 'RE-',
      startDate: '01.01.2024',
      endDate: new Date('2024-07-01T00:00:00Z'),
      contactId: 42,
      limit: 10,
      offset: 20,
      embed: ['supplier', 'costCentre'],
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Voucher?status=100&creditDebit=D&descriptionLike=RE-` +
        '&startDate=01.01.2024&endDate=1719792000' +
        '&contact%5Bid%5D=42&contact%5BobjectName%5D=Contact' +
        '&limit=10&offset=20&embed=supplier%2CcostCentre',
    );
  });

  it('omits the contact object name when no contact id is given', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).list({ status: 50 });

    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/Voucher?status=50`);
  });

  it('serializes the linked object filter', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).list({
      linkedObjectId: 77,
      linkedObjectName: 'CheckAccountTransaction',
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Voucher?object%5Bid%5D=77` +
        '&object%5BobjectName%5D=CheckAccountTransaction',
    );
  });

  it('omits the linked object name when no linked object id is given', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).list({
      linkedObjectName: 'CheckAccountTransaction',
    });

    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/Voucher`);
  });
});

describe('VouchersResource.get', () => {
  it('unwraps the single element array', async () => {
    const fetch = createMockFetch({ objects: [{ id: '1' }] });

    const voucher = await createResource(fetch).get({ voucherId: 1 });

    expect(voucher).toEqual({ id: '1' });
    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/Voucher/1`);
  });

  it('serializes the embed fields', async () => {
    const fetch = createMockFetch({ objects: [{ id: '1' }] });

    await createResource(fetch).get({
      voucherId: 1,
      embed: ['supplier', 'costCentre'],
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Voucher/1?embed=supplier%2CcostCentre`,
    );
  });

  it('throws a 404 error when the array is empty', async () => {
    const fetch = createMockFetch({ objects: [] });

    await expect(createResource(fetch).get({ voucherId: 1 })).rejects.toThrow(
      SevDeskError,
    );
    await expect(
      createResource(fetch).get({ voucherId: 1 }),
    ).rejects.toMatchObject({ status: 404, statusText: 'Not Found' });
  });
});

describe('VouchersResource.uploadFile', () => {
  it('sends multipart form data without a content type header', async () => {
    const fetch = createMockFetch({
      objects: { filename: 'hash.pdf', pages: 1 },
    });

    const result = await createResource(fetch).uploadFile({
      file: new Uint8Array([1, 2, 3]),
      filename: 'invoice.pdf',
    });

    expect(result.filename).toBe('hash.pdf');
    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Voucher/Factory/uploadTempFile`);
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers).not.toHaveProperty('Content-Type');
    const file = (init.body as FormData).get('file');
    expect(file).toBeInstanceOf(Blob);
    expect((file as File).name).toBe('invoice.pdf');
  });

  it('defaults the filename to upload', async () => {
    const fetch = createMockFetch({ objects: { filename: 'hash.pdf' } });

    await createResource(fetch).uploadFile({ file: new Blob(['content']) });

    const file = (lastRequest(fetch).init.body as FormData).get('file');
    expect((file as File).name).toBe('upload');
  });
});

describe('VouchersResource.save', () => {
  const savePayload = {
    objects: {
      voucher: { id: '1' },
      voucherPos: [{ id: '2' }],
      filename: 'hash.pdf',
    },
  };

  it('injects the boilerplate and keeps the required body key order', async () => {
    const fetch = createMockFetch(savePayload);

    const result = await createResource(fetch).save({
      voucher: {
        status: 50,
        creditDebit: 'D',
        taxRuleId: 1,
        voucherDate: '01.03.2024',
        supplierId: 42,
        description: 'RE-1000',
        costCentreId: 7,
      },
      positions: [{ accountDatevId: 27, taxRate: 19, net: true, sumNet: 100 }],
      filename: 'hash.pdf',
    });

    expect(result).toEqual({
      voucher: { id: '1' },
      positions: [{ id: '2' }],
      filename: 'hash.pdf',
    });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Voucher/Factory/saveVoucher`);
    expect(init.method).toBe('POST');

    const body = parsedBody(fetch);
    expect(Object.keys(body)).toEqual([
      'voucher',
      'voucherPosSave',
      'voucherPosDelete',
      'filename',
    ]);
    expect(rawBody(fetch).endsWith('"filename":"hash.pdf"}')).toBe(true);
    expect(body.voucherPosDelete).toBeNull();
    expect(body.voucher).toEqual({
      objectName: 'Voucher',
      mapAll: true,
      status: 50,
      creditDebit: 'D',
      taxRule: { id: 1, objectName: 'TaxRule' },
      voucherType: 'VOU',
      voucherDate: '01.03.2024',
      supplier: { id: 42, objectName: 'Contact' },
      description: 'RE-1000',
      costCentre: { id: 7, objectName: 'CostCentre' },
    });
    expect(body.voucherPosSave).toEqual([
      {
        objectName: 'VoucherPos',
        mapAll: true,
        voucher: null,
        accountDatev: { id: 27, objectName: 'AccountDatev' },
        taxRate: 19,
        net: true,
        sumNet: 100,
      },
    ]);
  });

  it('omits the filename key when no file is attached', async () => {
    const fetch = createMockFetch({
      objects: { voucher: { id: '1' }, voucherPos: [] },
    });

    const result = await createResource(fetch).save({
      voucher: {
        status: 100,
        creditDebit: 'C',
        taxRuleId: 11,
        voucherType: 'RV',
      },
      positions: [{ accountDatevId: 27, taxRate: 0, net: false, sumGross: 50 }],
    });

    expect(result.filename).toBeUndefined();
    const body = parsedBody(fetch);
    expect(Object.keys(body)).toEqual([
      'voucher',
      'voucherPosSave',
      'voucherPosDelete',
    ]);
    expect(body.voucher).toMatchObject({ voucherType: 'RV' });
  });
});

describe('VouchersResource.createFromFile', () => {
  it('uploads the file and saves the voucher with the internal filename', async () => {
    const urls: string[] = [];
    const fetch = vi.fn(
      async (...args: Parameters<typeof globalThis.fetch>) => {
        urls.push(String(args[0]));
        const payload =
          urls.length === 1
            ? { objects: { filename: 'hash.pdf' } }
            : { objects: { voucher: { id: '1' }, voucherPos: [] } };
        return new Response(JSON.stringify(payload), {
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
        });
      },
    );

    await createResource(fetch).createFromFile({
      file: new Blob(['content']),
      filename: 'invoice.pdf',
      voucher: { status: 50, creditDebit: 'D', taxRuleId: 1 },
      positions: [{ accountDatevId: 27, taxRate: 19, net: true, sumNet: 10 }],
    });

    expect(urls).toEqual([
      `${BASE_URL}/Voucher/Factory/uploadTempFile`,
      `${BASE_URL}/Voucher/Factory/saveVoucher`,
    ]);
    expect(parsedBody(fetch).filename).toBe('hash.pdf');
  });
});

describe('VouchersResource.update', () => {
  it('sends only the given draft fields', async () => {
    const fetch = createMockFetch({ objects: { id: '1' } });

    await createResource(fetch).update({
      voucherId: 1,
      description: 'RE-1001',
      voucherDate: new Date('2024-07-01T00:00:00Z'),
    });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Voucher/1`);
    expect(init.method).toBe('PUT');
    expect(parsedBody(fetch)).toEqual({
      voucherDate: 1719792000,
      description: 'RE-1001',
    });
  });
});

describe('VouchersResource.book', () => {
  it('builds the check account reference and omits the transaction by default', async () => {
    const fetch = createMockFetch({ objects: { id: '9' } });

    await createResource(fetch).book({
      voucherId: 1,
      amount: 119,
      date: new Date('2024-07-01T00:00:00Z'),
      type: 'FULL_PAYMENT',
      checkAccountId: 3,
    });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Voucher/1/bookAmount`);
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
      voucherId: 1,
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

describe('VouchersResource status transitions', () => {
  it('resets a voucher to open', async () => {
    const fetch = createMockFetch({ objects: { id: '1' } });

    await createResource(fetch).resetToOpen({ voucherId: 1 });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Voucher/1/resetToOpen`);
    expect(init.method).toBe('PUT');
    expect(init.body).toBeUndefined();
  });

  it('resets a voucher to draft', async () => {
    const fetch = createMockFetch({ objects: { id: '1' } });

    await createResource(fetch).resetToDraft({ voucherId: 1 });

    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/Voucher/1/resetToDraft`);
  });

  it('enshrines a voucher and returns nothing', async () => {
    const fetch = createMockFetch({ objects: null });

    await expect(
      createResource(fetch).enshrine({ voucherId: 1 }),
    ).resolves.toBeUndefined();

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/Voucher/1/enshrine`);
    expect(init.method).toBe('PUT');
  });
});

describe('VouchersResource.listPositions', () => {
  it('filters by the voucher reference', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).listPositions({ voucherId: 1, limit: 5 });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/VoucherPos?voucher%5Bid%5D=1&voucher%5BobjectName%5D=Voucher&limit=5`,
    );
  });

  it('omits the voucher filter when no voucher id is given', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).listPositions();

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/VoucherPos`);
    expect(init.method).toBe('GET');
  });

  it('serializes the embed fields', async () => {
    const fetch = createMockFetch({ objects: [] });

    await createResource(fetch).listPositions({ embed: ['voucher'] });

    expect(lastRequest(fetch).url).toBe(`${BASE_URL}/VoucherPos?embed=voucher`);
  });
});
