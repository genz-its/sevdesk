import { consola } from 'consola';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import contactsCommand from '../src/commands/export/contacts';
import datevCommand from '../src/commands/export/datev';
import invoicesCommand from '../src/commands/export/invoices';
import vouchersCommand from '../src/commands/export/vouchers';
import { isInteractive } from '../src/interactive';

vi.mock('../src/interactive', () => ({ isInteractive: vi.fn(() => false) }));
vi.mock('../src/prompt', () => ({
  promptConfirm: vi.fn(),
  promptText: vi.fn(),
}));

function jsonResponse(payload?: unknown): Response {
  return new Response(payload === undefined ? null : JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function stubFetch(...payloads: unknown[]) {
  const responses = payloads.map((payload) => jsonResponse(payload));
  const fetchMock = vi.fn<typeof globalThis.fetch>(
    async () => responses.shift() ?? jsonResponse(),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function requestUrlAt(
  fetchMock: ReturnType<typeof vi.fn<typeof globalThis.fetch>>,
  index: number,
): URL {
  const call = fetchMock.mock.calls[index];
  if (!call) {
    throw new Error(`No fetch call recorded at index ${index}.`);
  }
  return new URL(String(call[0]));
}

describe('export commands', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sevdesk-cli-'));
    vi.stubEnv('SEVDESK_TOKEN', 'test-token');
    vi.mocked(isInteractive).mockReturnValue(false);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(consola, 'start').mockImplementation(() => {});
    vi.spyOn(consola, 'success').mockImplementation(() => {});
    vi.spyOn(consola, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('writes the decoded invoice CSV and builds the sevQuery', async () => {
    const csv = 'id;invoiceNumber\n1;RE-1001\n';
    const fetchMock = stubFetch({
      objects: {
        filename: 'invoices.csv',
        mimetype: 'text/csv',
        base64Encoded: true,
        content: Buffer.from(csv).toString('base64'),
      },
    });
    const path = join(dir, 'invoices.csv');

    await invoicesCommand.action(
      {
        output: path,
        limit: 50,
        startDate: '2024-01-01',
        endDate: '2024-03-31',
        json: false,
      },
      undefined,
    );

    const url = requestUrlAt(fetchMock, 0);
    expect(url.pathname).toBe('/api/v1/Export/invoiceCsv');
    expect(url.searchParams.get('sevQuery[modelName]')).toBe('Invoice');
    expect(url.searchParams.get('sevQuery[limit]')).toBe('50');
    expect(url.searchParams.get('sevQuery[filter][startDate]')).toBe(
      '2024-01-01',
    );
    expect(url.searchParams.get('sevQuery[filter][endDate]')).toBe(
      '2024-03-31',
    );
    await expect(readFile(path, 'utf8')).resolves.toBe(csv);
    expect(consola.success).toHaveBeenCalledWith(`Saved ${path}.`);
  });

  it('writes the voucher CSV as-is when it is not base64 encoded', async () => {
    const fetchMock = stubFetch({
      objects: {
        filename: 'vouchers.csv',
        mimetype: 'text/csv',
        base64Encoded: false,
        content: 'id;supplier\n42;Acme GmbH\n',
      },
    });
    const path = join(dir, 'vouchers.csv');

    await vouchersCommand.action({ output: path, json: false }, undefined);

    const url = requestUrlAt(fetchMock, 0);
    expect(url.pathname).toBe('/api/v1/Export/voucherListCsv');
    expect(url.searchParams.get('sevQuery[modelName]')).toBe('Voucher');
    await expect(readFile(path, 'utf8')).resolves.toBe(
      'id;supplier\n42;Acme GmbH\n',
    );
  });

  it('prints the contact export result as JSON', async () => {
    const fetchMock = stubFetch({
      objects: {
        filename: 'contacts.csv',
        mimetype: 'text/csv',
        base64Encoded: false,
        content: 'id;name\n',
      },
    });
    const path = join(dir, 'contacts.csv');

    await contactsCommand.action({ output: path, json: true }, undefined);

    const url = requestUrlAt(fetchMock, 0);
    expect(url.pathname).toBe('/api/v1/Export/contactListCsv');
    expect(url.searchParams.get('sevQuery[modelName]')).toBe('Contact');
    expect(JSON.parse(vi.mocked(console.log).mock.calls[0]?.[0])).toEqual({
      filename: 'contacts.csv',
      path,
    });
  });

  it('downloads the DATEV export once the job is finished', async () => {
    const fetchMock = vi.fn<typeof globalThis.fetch>();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ objects: 'job-1' }))
      .mockResolvedValueOnce(
        jsonResponse({
          objects: [
            {
              filename: 'datev.zip',
              link: 'https://download.example.com/datev.zip',
              linkExpireDate: '2026-08-05T00:00:00+02:00',
            },
          ],
        }),
      )
      .mockResolvedValueOnce(new Response('zip content'));
    vi.stubGlobal('fetch', fetchMock);
    const path = join(dir, 'datev.zip');

    await datevCommand.action(
      {
        startDate: '01.01.2024',
        endDate: '31.03.2024',
        format: 'csv',
        scope: 'EXTCD',
        output: path,
        timeout: 300,
        json: false,
      },
      undefined,
    );

    const createUrl = requestUrlAt(fetchMock, 0);
    expect(createUrl.pathname).toBe(
      '/api/v1/Export/createDatevCsvZipExportJob',
    );
    expect(createUrl.searchParams.get('startDate')).toBe('01.01.2024');
    expect(createUrl.searchParams.get('endDate')).toBe('31.03.2024');
    expect(createUrl.searchParams.get('scope')).toBe('EXTCD');
    const infoUrl = requestUrlAt(fetchMock, 1);
    expect(infoUrl.pathname).toBe('/api/v1/ExportJob/jobDownloadInfo');
    expect(infoUrl.searchParams.get('jobId')).toBe('job-1');
    const downloadCall = fetchMock.mock.calls[2];
    expect(String(downloadCall?.[0])).toBe(
      'https://download.example.com/datev.zip',
    );
    expect(downloadCall?.[1]).toBeUndefined();
    await expect(readFile(path, 'utf8')).resolves.toBe('zip content');
    expect(consola.success).toHaveBeenCalledWith(`Saved ${path}.`);
  });

  it('exits when the export job does not finish in time', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof globalThis.fetch>();
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ objects: 'job-9' }))
      .mockResolvedValueOnce(jsonResponse({ objects: [] }))
      .mockImplementation(
        async () => new Response('Not Found', { status: 404 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    const promise = datevCommand.action(
      {
        startDate: '01.01.2024',
        endDate: '31.03.2024',
        format: 'csv',
        scope: 'EXTCD',
        timeout: 10,
        json: false,
      },
      undefined,
    );
    const expectation = expect(promise).rejects.toThrow('process.exit(1)');
    await vi.advanceTimersByTimeAsync(30_000);
    await expectation;

    expect(consola.error).toHaveBeenCalledWith(
      'The export job did not finish within 10 seconds.',
    );
  });

  it('exits without a start date in a non-interactive environment', async () => {
    const fetchMock = stubFetch();

    await expect(
      datevCommand.action(
        { format: 'csv', scope: 'EXTCD', timeout: 300, json: false },
        undefined,
      ),
    ).rejects.toThrow('process.exit(1)');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(consola.error).toHaveBeenCalledWith(
      'You must provide a start date via --start-date when running in a non-interactive environment.',
    );
  });
});
