import { describe, expect, it } from 'vitest';
import { ExportsResource } from '../src/resources/exports';
import { createHttpClient, createMockFetch, lastRequest } from './helpers';

const BASE_URL = 'https://my.sevdesk.de/api/v1';

const exportFile = {
  filename: 'invoices.csv',
  mimetype: 'text/csv',
  base64Encoded: true,
  content: 'aWQ7bnVtYmVy',
};

function createResource(fetch: typeof globalThis.fetch): ExportsResource {
  return new ExportsResource(createHttpClient(fetch));
}

describe('ExportsResource.updateExportConfig', () => {
  it('sends the accounting config as a body', async () => {
    const fetch = createMockFetch({ objects: null });

    await createResource(fetch).updateExportConfig({
      sevClientId: 1,
      accountantNumber: 1324124,
      accountantClientNumber: 1234152,
      accountingYearBegin: new Date('2023-01-01T00:00:00Z'),
    });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${BASE_URL}/SevClient/1/updateExportConfig`);
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body as string)).toEqual({
      accountantNumber: 1324124,
      accountantClientNumber: 1234152,
      accountingYearBegin: 1672531200,
    });
  });
});

describe('ExportsResource.createDatevCsvZipExportJob', () => {
  it('sends timestamps and all export flags', async () => {
    const fetch = createMockFetch({
      objects: '0a0e1eff-9590-1bea-1195-a3cfc04364cc',
    });

    const result = await createResource(fetch).createDatevCsvZipExportJob({
      startDate: new Date('2022-01-01T12:07:47Z'),
      endDate: 1648805267,
      scope: 'EXTCD',
      exportByPaydate: true,
      includeEnshrined: false,
      enshrineDocuments: true,
      includeDocumentImages: true,
    });

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(
      `${BASE_URL}/Export/createDatevCsvZipExportJob` +
        '?startDate=1641038867&endDate=1648805267&scope=EXTCD' +
        '&exportByPaydate=1&includeEnshrined=0' +
        '&enshrineDocuments=1&includeDocumentImages=1',
    );
    expect(init.method).toBe('GET');
    expect(result).toBe('0a0e1eff-9590-1bea-1195-a3cfc04364cc');
  });

  it('omits optional flags', async () => {
    const fetch = createMockFetch({ objects: 'job-id' });

    await createResource(fetch).createDatevCsvZipExportJob({
      startDate: 1641032867,
      endDate: 1648805267,
      scope: 'EXTD',
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Export/createDatevCsvZipExportJob` +
        '?startDate=1641032867&endDate=1648805267&scope=EXTD',
    );
  });
});

describe('ExportsResource.createDatevXmlZipExportJob', () => {
  it('sends the xml specific flags', async () => {
    const fetch = createMockFetch({ objects: 'job-id' });

    await createResource(fetch).createDatevXmlZipExportJob({
      startDate: 1641032867,
      endDate: 1648805267,
      scope: 'EX',
      exportByPaydate: false,
      includeEnshrined: true,
      includeExportedDocuments: false,
      includeDocumentXml: true,
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Export/createDatevXmlZipExportJob` +
        '?startDate=1641032867&endDate=1648805267&scope=EX' +
        '&exportByPaydate=0&includeEnshrined=1' +
        '&includeExportedDocuments=0&includeDocumentXml=1',
    );
  });
});

describe('ExportsResource.generateDownloadHash', () => {
  it('sends the job id', async () => {
    const fetch = createMockFetch({ objects: [{ current: 0, total: 100 }] });

    const result = await createResource(fetch).generateDownloadHash({
      jobId: '0a0e1eff-9590-1bea-1195-a3cfc04364cc',
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Progress/generateDownloadHash` +
        '?jobId=0a0e1eff-9590-1bea-1195-a3cfc04364cc',
    );
    expect(result).toEqual([{ current: 0, total: 100 }]);
  });
});

describe('ExportsResource.getProgress', () => {
  it('sends the progress hash', async () => {
    const fetch = createMockFetch({ objects: [{ current: 33, total: 100 }] });

    const result = await createResource(fetch).getProgress({
      hash: '22ae177d286f17aac5daac591c70164159b64c7f_0a0e1eff',
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Progress/getProgress` +
        '?hash=22ae177d286f17aac5daac591c70164159b64c7f_0a0e1eff',
    );
    expect(result).toEqual([{ current: 33, total: 100 }]);
  });
});

describe('ExportsResource.getJobDownloadInfo', () => {
  it('sends the job id and returns the download info', async () => {
    const downloadInfo = {
      filename: 'export.zip',
      link: 'https://example.com/export.zip',
      linkExpireDate: '2025-03-24T12:14:22+01:00',
    };
    const fetch = createMockFetch({ objects: [downloadInfo] });

    const result = await createResource(fetch).getJobDownloadInfo({
      jobId: '0a0e1eff-9590-1bea-1195-a3cfc04364cc',
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/ExportJob/jobDownloadInfo` +
        '?jobId=0a0e1eff-9590-1bea-1195-a3cfc04364cc',
    );
    expect(result).toEqual([downloadInfo]);
  });
});

describe('ExportsResource.exportInvoicesCsv', () => {
  it('sends the minimal sevQuery', async () => {
    const fetch = createMockFetch({ objects: exportFile });

    const result = await createResource(fetch).exportInvoicesCsv();

    const { url, init } = lastRequest(fetch);
    expect(url).toBe(
      `${BASE_URL}/Export/invoiceCsv` +
        '?sevQuery%5BobjectName%5D=SevQuery&sevQuery%5BmodelName%5D=Invoice',
    );
    expect(init.method).toBe('GET');
    expect(result).toEqual(exportFile);
  });

  it('flattens the download flag, the limit and all invoice filters', async () => {
    const fetch = createMockFetch({ objects: exportFile });

    await createResource(fetch).exportInvoicesCsv({
      download: true,
      limit: 1000,
      filter: {
        invoiceType: ['RE', 'SR'],
        startDate: new Date('2024-01-01T00:00:00Z'),
        endDate: '2024-03-31T23:59:59Z',
        contactId: 42,
        startAmount: 100,
        endAmount: 150,
      },
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Export/invoiceCsv?download=1` +
        '&sevQuery%5BobjectName%5D=SevQuery&sevQuery%5BmodelName%5D=Invoice' +
        '&sevQuery%5Blimit%5D=1000' +
        '&sevQuery%5Bfilter%5D%5BstartDate%5D=2024-01-01T00%3A00%3A00.000Z' +
        '&sevQuery%5Bfilter%5D%5BendDate%5D=2024-03-31T23%3A59%3A59Z' +
        '&sevQuery%5Bfilter%5D%5Bcontact%5D%5Bid%5D=42' +
        '&sevQuery%5Bfilter%5D%5Bcontact%5D%5BobjectName%5D=Contact' +
        '&sevQuery%5Bfilter%5D%5BstartAmount%5D=100' +
        '&sevQuery%5Bfilter%5D%5BendAmount%5D=150' +
        '&sevQuery%5Bfilter%5D%5BinvoiceType%5D%5B0%5D=RE' +
        '&sevQuery%5Bfilter%5D%5BinvoiceType%5D%5B1%5D=SR',
    );
  });
});

describe('ExportsResource.exportInvoicesZip', () => {
  it('requests the invoice zip export', async () => {
    const fetch = createMockFetch({ objects: exportFile });

    await createResource(fetch).exportInvoicesZip({ limit: 10 });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Export/invoiceZip` +
        '?sevQuery%5BobjectName%5D=SevQuery&sevQuery%5BmodelName%5D=Invoice' +
        '&sevQuery%5Blimit%5D=10',
    );
  });
});

describe('ExportsResource.exportCreditNotesCsv', () => {
  it('uses the credit note model name', async () => {
    const fetch = createMockFetch({ objects: exportFile });

    await createResource(fetch).exportCreditNotesCsv({
      filter: { contactId: 7 },
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Export/creditNoteCsv` +
        '?sevQuery%5BobjectName%5D=SevQuery&sevQuery%5BmodelName%5D=CreditNote' +
        '&sevQuery%5Bfilter%5D%5Bcontact%5D%5Bid%5D=7' +
        '&sevQuery%5Bfilter%5D%5Bcontact%5D%5BobjectName%5D=Contact',
    );
  });
});

describe('ExportsResource.exportVouchersCsv', () => {
  it('flattens the voucher pay date filters', async () => {
    const fetch = createMockFetch({ objects: exportFile });

    await createResource(fetch).exportVouchersCsv({
      filter: {
        startPayDate: new Date('2024-02-01T00:00:00Z'),
        endPayDate: new Date('2024-02-29T00:00:00Z'),
      },
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Export/voucherListCsv` +
        '?sevQuery%5BobjectName%5D=SevQuery&sevQuery%5BmodelName%5D=Voucher' +
        '&sevQuery%5Bfilter%5D%5BstartPayDate%5D=2024-02-01T00%3A00%3A00.000Z' +
        '&sevQuery%5Bfilter%5D%5BendPayDate%5D=2024-02-29T00%3A00%3A00.000Z',
    );
  });
});

describe('ExportsResource.exportVouchersZip', () => {
  it('requests the voucher zip export', async () => {
    const fetch = createMockFetch({ objects: exportFile });

    await createResource(fetch).exportVouchersZip({ download: false });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Export/voucherZip?download=0` +
        '&sevQuery%5BobjectName%5D=SevQuery&sevQuery%5BmodelName%5D=Voucher',
    );
  });
});

describe('ExportsResource.exportTransactionsCsv', () => {
  it('flattens the transaction filters including the check account', async () => {
    const fetch = createMockFetch({ objects: exportFile });

    await createResource(fetch).exportTransactionsCsv({
      limit: 500,
      filter: {
        paymtPurpose: 'salary',
        name: 'Cercei Lannister',
        startDate: new Date('2024-01-01T00:00:00Z'),
        startAmount: 100,
        checkAccountId: 1,
      },
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Export/transactionsCsv` +
        '?sevQuery%5BobjectName%5D=SevQuery' +
        '&sevQuery%5BmodelName%5D=CheckAccountTransaction' +
        '&sevQuery%5Blimit%5D=500' +
        '&sevQuery%5Bfilter%5D%5BpaymtPurpose%5D=salary' +
        '&sevQuery%5Bfilter%5D%5Bname%5D=Cercei+Lannister' +
        '&sevQuery%5Bfilter%5D%5BstartDate%5D=2024-01-01T00%3A00%3A00.000Z' +
        '&sevQuery%5Bfilter%5D%5BstartAmount%5D=100' +
        '&sevQuery%5Bfilter%5D%5BcheckAccount%5D%5Bid%5D=1' +
        '&sevQuery%5Bfilter%5D%5BcheckAccount%5D%5BobjectName%5D=CheckAccount',
    );
  });
});

describe('ExportsResource.exportContactsCsv', () => {
  it('flattens the contact filters including the country', async () => {
    const fetch = createMockFetch({ objects: exportFile });

    await createResource(fetch).exportContactsCsv({
      filter: {
        zip: 77656,
        city: 'Offenburg',
        countryId: 1,
        depth: false,
        onlyPeople: true,
      },
    });

    expect(lastRequest(fetch).url).toBe(
      `${BASE_URL}/Export/contactListCsv` +
        '?sevQuery%5BobjectName%5D=SevQuery&sevQuery%5BmodelName%5D=Contact' +
        '&sevQuery%5Bfilter%5D%5Bzip%5D=77656' +
        '&sevQuery%5Bfilter%5D%5Bcity%5D=Offenburg' +
        '&sevQuery%5Bfilter%5D%5Bcountry%5D%5Bid%5D=1' +
        '&sevQuery%5Bfilter%5D%5Bcountry%5D%5BobjectName%5D=StaticCountry' +
        '&sevQuery%5Bfilter%5D%5Bdepth%5D=0' +
        '&sevQuery%5Bfilter%5D%5BonlyPeople%5D=1',
    );
  });
});
