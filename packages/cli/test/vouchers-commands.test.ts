import { consola } from 'consola';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import bookCommand from '../src/commands/vouchers/book';
import createCommand from '../src/commands/vouchers/create';
import enshrineCommand from '../src/commands/vouchers/enshrine';
import getCommand from '../src/commands/vouchers/get';
import listCommand from '../src/commands/vouchers/list';
import resetToOpenCommand from '../src/commands/vouchers/reset-to-open';
import { isInteractive } from '../src/interactive';
import { promptConfirm } from '../src/prompt';

vi.mock('../src/interactive', () => ({ isInteractive: vi.fn(() => false) }));
vi.mock('../src/prompt', () => ({
  promptConfirm: vi.fn(),
  promptText: vi.fn(),
}));

const voucher = {
  id: '42',
  objectName: 'Voucher',
  voucherDate: '2024-01-15T00:00:00+01:00',
  supplier: null,
  supplierName: 'Acme GmbH',
  description: 'RE-1',
  status: '100',
  sumNet: '100.00',
  sumTax: '19.00',
  sumGross: '119.00',
  currency: 'EUR',
  enshrined: null,
};

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

function requestAt(
  fetchMock: ReturnType<typeof stubFetch>,
  index: number,
): { url: string; init: RequestInit } {
  const call = fetchMock.mock.calls[index];
  if (!call) {
    throw new Error(`No fetch call recorded at index ${index}.`);
  }
  return { url: String(call[0]), init: call[1] ?? {} };
}

function expectExit(promise: Promise<void>) {
  return expect(promise).rejects.toThrow('process.exit(1)');
}

describe('voucher commands', () => {
  beforeEach(() => {
    vi.stubEnv('SEVDESK_TOKEN', 'test-token');
    vi.mocked(isInteractive).mockReturnValue(false);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(consola, 'info').mockImplementation(() => {});
    vi.spyOn(consola, 'success').mockImplementation(() => {});
    vi.spyOn(consola, 'error').mockImplementation(() => {});
    vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${code})`);
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('builds the query and prints a table', async () => {
      const fetchMock = stubFetch({ objects: [voucher] });
      await listCommand.action(
        {
          status: 100,
          creditDebit: 'C',
          descriptionLike: 'RE',
          contact: 7,
          limit: 10,
          json: false,
        },
        undefined,
      );
      const { url, init } = requestAt(fetchMock, 0);
      expect(init.method).toBe('GET');
      expect(url).toContain('/Voucher?');
      expect(url).toContain('status=100');
      expect(url).toContain('creditDebit=C');
      expect(url).toContain('descriptionLike=RE');
      expect(url).toContain('contact%5Bid%5D=7');
      expect(url).toContain('contact%5BobjectName%5D=Contact');
      expect(url).toContain('limit=10');
      expect(url).toContain('embed=supplier');
      const output = vi.mocked(console.log).mock.calls.flat().join('\n');
      expect(output).toContain('SUPPLIER');
      expect(output).toContain('Acme GmbH');
      expect(output).toContain('119.00');
    });

    it('prints the name of the embedded supplier', async () => {
      stubFetch({
        objects: [
          {
            ...voucher,
            supplierName: null,
            supplier: {
              id: '107003395',
              objectName: 'Contact',
              name: 'Beispiel GmbH',
              surename: null,
              familyname: null,
            },
          },
        ],
      });
      await listCommand.action({ json: false }, undefined);
      const output = vi.mocked(console.log).mock.calls.flat().join('\n');
      expect(output).toContain('Beispiel GmbH');
    });

    it('falls back to the supplier id when no name is embedded', async () => {
      stubFetch({
        objects: [
          {
            ...voucher,
            supplierName: null,
            supplier: { id: '107003395', objectName: 'Contact' },
          },
        ],
      });
      await listCommand.action({ json: false }, undefined);
      const output = vi.mocked(console.log).mock.calls.flat().join('\n');
      expect(output).toContain('107003395');
    });

    it('reports an empty result', async () => {
      stubFetch({ objects: [] });
      await listCommand.action({ json: false }, undefined);
      expect(consola.info).toHaveBeenCalledWith('No vouchers found.');
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('prints the voucher as JSON', async () => {
      const fetchMock = stubFetch({ objects: [voucher] });
      await getCommand.action({ id: 42, json: true }, undefined);
      const { url } = requestAt(fetchMock, 0);
      expect(url).toContain('/Voucher/42');
      expect(url).toContain('embed=supplier');
      expect(JSON.parse(vi.mocked(console.log).mock.calls[0]?.[0])).toEqual(
        voucher,
      );
    });

    it('prints the name of the embedded person supplier', async () => {
      stubFetch({
        objects: [
          {
            ...voucher,
            supplierName: null,
            supplier: {
              id: '107003395',
              objectName: 'Contact',
              name: null,
              surename: 'Erika',
              familyname: 'Musterfrau',
            },
          },
        ],
      });
      await getCommand.action({ id: 42, json: false }, undefined);
      expect(consola.info).toHaveBeenCalledWith('Supplier: Erika Musterfrau');
    });

    it('exits without an id in a non-interactive environment', async () => {
      const fetchMock = stubFetch({ objects: [voucher] });
      await expectExit(getCommand.action({ json: false }, undefined));
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    async function writeReceipt(): Promise<string> {
      const path = join(
        await mkdtemp(join(tmpdir(), 'sevdesk-cli-')),
        'receipt.pdf',
      );
      await writeFile(path, 'receipt content');
      return path;
    }

    it('uploads the file and saves the voucher', async () => {
      const path = await writeReceipt();
      const fetchMock = stubFetch(
        { objects: { filename: 'tmp-1.pdf', pages: 1 } },
        { objects: { voucher, voucherPos: [] } },
      );
      await createCommand.action(
        {
          file: path,
          status: 'open',
          creditDebit: 'C',
          taxRule: 9,
          accountDatev: 1600,
          amount: 119,
          net: false,
          taxRate: 19,
          supplierName: 'Acme GmbH',
          description: 'RE-1',
          json: false,
        },
        undefined,
      );
      const upload = requestAt(fetchMock, 0);
      expect(upload.url).toContain('/Voucher/Factory/uploadTempFile');
      expect(upload.init.method).toBe('POST');
      expect(upload.init.body).toBeInstanceOf(FormData);
      const file = (upload.init.body as FormData).get('file') as File;
      expect(file.name).toBe('receipt.pdf');
      const save = requestAt(fetchMock, 1);
      expect(save.url).toContain('/Voucher/Factory/saveVoucher');
      expect(JSON.parse(save.init.body as string)).toMatchObject({
        filename: 'tmp-1.pdf',
        voucher: {
          status: 100,
          creditDebit: 'C',
          taxRule: { id: 9, objectName: 'TaxRule' },
          voucherType: 'VOU',
          supplierName: 'Acme GmbH',
          description: 'RE-1',
        },
        voucherPosSave: [
          {
            accountDatev: { id: 1600, objectName: 'AccountDatev' },
            taxRate: 19,
            net: false,
            sumGross: 119,
          },
        ],
      });
      expect(consola.success).toHaveBeenCalledWith(
        'Created voucher 42 with status 100.',
      );
    });

    it('sends a net position and a draft status with --net and --status draft', async () => {
      const path = await writeReceipt();
      const fetchMock = stubFetch(
        { objects: { filename: 'tmp-2.pdf' } },
        { objects: { voucher, voucherPos: [] } },
      );
      await createCommand.action(
        {
          file: path,
          status: 'draft',
          creditDebit: 'C',
          taxRule: 9,
          accountDatev: 1600,
          amount: 100,
          net: true,
          taxRate: 19,
          supplierName: 'Acme GmbH',
          json: false,
        },
        undefined,
      );
      const body = JSON.parse(requestAt(fetchMock, 1).init.body as string);
      expect(body.voucher.status).toBe(50);
      expect(body.voucherPosSave[0]).toMatchObject({ net: true, sumNet: 100 });
      expect(body.voucherPosSave[0].sumGross).toBeUndefined();
    });

    it('exits when the file cannot be read', async () => {
      const fetchMock = stubFetch();
      await expectExit(
        createCommand.action(
          {
            file: join(tmpdir(), 'sevdesk-cli-missing.pdf'),
            status: 'open',
            creditDebit: 'C',
            taxRule: 9,
            accountDatev: 1600,
            amount: 119,
            net: false,
            taxRate: 19,
            supplierName: 'Acme GmbH',
            json: false,
          },
          undefined,
        ),
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('book', () => {
    it('books the amount with --yes', async () => {
      const fetchMock = stubFetch({
        objects: { fromStatus: '100', toStatus: '1000' },
      });
      await bookCommand.action(
        {
          id: 42,
          amount: 119,
          date: '2024-02-01T00:00:00.000Z',
          type: 'FULL_PAYMENT',
          checkAccount: 3,
          transaction: 5,
          yes: true,
          json: false,
        },
        undefined,
      );
      const { url, init } = requestAt(fetchMock, 0);
      expect(url).toContain('/Voucher/42/bookAmount');
      expect(init.method).toBe('PUT');
      expect(JSON.parse(init.body as string)).toMatchObject({
        amount: 119,
        date: '2024-02-01T00:00:00.000Z',
        type: 'FULL_PAYMENT',
        checkAccount: { id: 3, objectName: 'CheckAccount' },
        checkAccountTransaction: {
          id: 5,
          objectName: 'CheckAccountTransaction',
        },
      });
      expect(consola.success).toHaveBeenCalledWith(
        'Booked 119 on voucher 42. Status changed from 100 to 1000.',
      );
    });

    it('aborts when the confirmation is declined', async () => {
      const fetchMock = stubFetch();
      vi.mocked(isInteractive).mockReturnValue(true);
      vi.mocked(promptConfirm).mockResolvedValue(false);
      await bookCommand.action(
        {
          id: 42,
          amount: 119,
          date: '2024-02-01T00:00:00.000Z',
          type: 'FULL_PAYMENT',
          checkAccount: 3,
          yes: false,
          json: false,
        },
        undefined,
      );
      expect(promptConfirm).toHaveBeenCalledWith('Book 119 on voucher 42?');
      expect(fetchMock).not.toHaveBeenCalled();
      expect(consola.info).toHaveBeenCalledWith('Aborted.');
    });
  });

  describe('reset-to-open', () => {
    it('resets the voucher with --yes', async () => {
      const fetchMock = stubFetch({ objects: voucher });
      await resetToOpenCommand.action(
        { id: 42, yes: true, json: false },
        undefined,
      );
      const { url, init } = requestAt(fetchMock, 0);
      expect(url).toContain('/Voucher/42/resetToOpen');
      expect(init.method).toBe('PUT');
    });
  });

  describe('enshrine', () => {
    it('enshrines the voucher with --yes', async () => {
      const fetchMock = stubFetch(undefined);
      await enshrineCommand.action(
        { id: 42, yes: true, json: true },
        undefined,
      );
      const { url, init } = requestAt(fetchMock, 0);
      expect(url).toContain('/Voucher/42/enshrine');
      expect(init.method).toBe('PUT');
      expect(JSON.parse(vi.mocked(console.log).mock.calls[0]?.[0])).toEqual({
        enshrined: true,
      });
    });

    it('exits without --yes in a non-interactive environment', async () => {
      const fetchMock = stubFetch();
      await expectExit(
        enshrineCommand.action({ id: 42, yes: false, json: false }, undefined),
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
