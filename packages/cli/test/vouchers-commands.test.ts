import { consola } from 'consola';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import bookCommand from '../src/commands/vouchers/book';
import createCommand from '../src/commands/vouchers/create';
import documentCommand from '../src/commands/vouchers/document';
import enshrineCommand from '../src/commands/vouchers/enshrine';
import getCommand from '../src/commands/vouchers/get';
import listCommand from '../src/commands/vouchers/list';
import openCommand from '../src/commands/vouchers/open';
import positionsCommand from '../src/commands/vouchers/positions';
import resetToOpenCommand from '../src/commands/vouchers/reset-to-open';
import updateCommand from '../src/commands/vouchers/update';
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
  deliveryDate: '2024-01-01T00:00:00+01:00',
  deliveryDateUntil: '2024-01-31T00:00:00+01:00',
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

const position = {
  id: '1001',
  objectName: 'VoucherPos',
  voucher: { id: '42', objectName: 'Voucher' },
  accountDatev: { id: '27', objectName: 'AccountDatev' },
  taxRate: '19',
  net: '0',
  sumNet: '100.00',
  sumGross: '119.00',
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
    async () => responses.shift() ?? jsonResponse({ objects: [] }),
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

    it('renders the service period as a single column', async () => {
      stubFetch({
        objects: [
          voucher,
          { ...voucher, id: '43', deliveryDateUntil: null },
          { ...voucher, id: '44', deliveryDate: null, deliveryDateUntil: null },
        ],
      });
      await listCommand.action({ json: false }, undefined);
      const output = vi.mocked(console.log).mock.calls.flat().join('\n');
      expect(output).toContain('SERVICEPERIOD');
      expect(output).toContain('2024-01-01 – 2024-01-31');
      // A voucher without an end date collapses to the single service date.
      expect(output).toMatch(/43\s+\S+\s+2024-01-01\s/);
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

  describe('positions', () => {
    it('filters by voucher and embeds the booking account', async () => {
      const fetchMock = stubFetch({ objects: [position] });
      await positionsCommand.action(
        { voucher: 42, limit: 10, json: false },
        undefined,
      );
      const { url, init } = requestAt(fetchMock, 0);
      expect(init.method).toBe('GET');
      expect(url).toContain('/VoucherPos?');
      expect(url).toContain('voucher%5Bid%5D=42');
      expect(url).toContain('voucher%5BobjectName%5D=Voucher');
      expect(url).toContain('limit=10');
      expect(url).toContain('embed=accountDatev');
      const output = vi.mocked(console.log).mock.calls.flat().join('\n');
      expect(output).toContain('ACCOUNT');
      expect(output).toContain('27');
      expect(output).toContain('119.00');
    });

    it('lists all positions without --voucher', async () => {
      const fetchMock = stubFetch({ objects: [position] });
      await positionsCommand.action({ json: false }, undefined);
      const { url } = requestAt(fetchMock, 0);
      expect(url).not.toContain('voucher%5Bid%5D');
      expect(url).toContain('embed=accountDatev');
    });

    it('prints the number and name of the embedded booking account', async () => {
      stubFetch({
        objects: [
          {
            ...position,
            accountDatev: {
              id: '27',
              objectName: 'AccountDatev',
              number: '3300',
              name: 'Wareneingang',
            },
          },
        ],
      });
      await positionsCommand.action({ json: false }, undefined);
      const output = vi.mocked(console.log).mock.calls.flat().join('\n');
      expect(output).toContain('3300 Wareneingang');
    });

    it('renders legacy positions without an accountDatev', async () => {
      stubFetch({
        objects: [
          {
            ...position,
            accountDatev: null,
            accountingType: { id: '74', objectName: 'AccountingType' },
          },
          { ...position, id: '2', accountDatev: null, accountingType: null },
        ],
      });
      await positionsCommand.action({ json: false }, undefined);
      const output = vi.mocked(console.log).mock.calls.flat().join('\n');
      expect(output).toContain('74');
      expect(output).toContain('-');
    });

    it('prints the positions as JSON', async () => {
      stubFetch({ objects: [position] });
      await positionsCommand.action({ json: true }, undefined);
      expect(JSON.parse(vi.mocked(console.log).mock.calls[0]?.[0])).toEqual([
        position,
      ]);
    });

    it('reports an empty result', async () => {
      stubFetch({ objects: [] });
      await positionsCommand.action({ json: false }, undefined);
      expect(consola.info).toHaveBeenCalledWith('No voucher positions found.');
    });
  });

  describe('document', () => {
    const documentContent = Buffer.from('%PDF-1.4 receipt');
    const documentFile = {
      filename: 'receipt.pdf',
      mimeType: 'application/pdf',
      base64Encoded: true,
      content: documentContent.toString('base64'),
    };
    const voucherWithDocument = {
      ...voucher,
      document: { id: '7', objectName: 'Document' },
    };

    async function tempPath(): Promise<string> {
      return join(await mkdtemp(join(tmpdir(), 'sevdesk-cli-')), 'receipt.pdf');
    }

    it('writes the decoded document of the voucher to the output path', async () => {
      const fetchMock = stubFetch(
        { objects: [voucherWithDocument] },
        { objects: documentFile },
      );
      const path = await tempPath();
      await documentCommand.action(
        { id: 42, output: path, json: true },
        undefined,
      );
      expect(requestAt(fetchMock, 0).url).toContain('/Voucher/42');
      expect(requestAt(fetchMock, 1).url).toContain('/Document/7/download');
      expect(await readFile(path)).toEqual(documentContent);
      expect(JSON.parse(vi.mocked(console.log).mock.calls[0]?.[0])).toEqual({
        filename: 'receipt.pdf',
        path,
      });
    });

    it('derives a file name from the voucher ID when the API reports none', async () => {
      stubFetch(
        { objects: [voucherWithDocument] },
        { objects: { ...documentFile, filename: null } },
      );
      const cwd = process.cwd();
      process.chdir(await mkdtemp(join(tmpdir(), 'sevdesk-cli-')));
      try {
        await documentCommand.action({ id: 42, json: true }, undefined);
        expect(await readFile('voucher-42.pdf')).toEqual(documentContent);
      } finally {
        process.chdir(cwd);
      }
    });

    it('strips directory components from the reported file name', async () => {
      stubFetch(
        { objects: [voucherWithDocument] },
        { objects: { ...documentFile, filename: '../../escape.pdf' } },
      );
      const cwd = process.cwd();
      process.chdir(await mkdtemp(join(tmpdir(), 'sevdesk-cli-')));
      try {
        await documentCommand.action({ id: 42, json: true }, undefined);
        expect(await readFile('escape.pdf')).toEqual(documentContent);
      } finally {
        process.chdir(cwd);
      }
    });

    it('writes raw content when the API flags it as not base64 encoded', async () => {
      stubFetch(
        { objects: [voucherWithDocument] },
        {
          objects: {
            ...documentFile,
            base64Encoded: false,
            content: '<xml/>',
          },
        },
      );
      const path = await tempPath();
      await documentCommand.action(
        { id: 42, output: path, json: false },
        undefined,
      );
      expect(await readFile(path, 'utf8')).toBe('<xml/>');
    });

    it('exits when the voucher has no document', async () => {
      const fetchMock = stubFetch({
        objects: [{ ...voucher, document: null }],
      });
      await expectExit(
        documentCommand.action(
          { id: 42, output: await tempPath(), json: false },
          undefined,
        ),
      );
      expect(consola.error).toHaveBeenCalledWith(
        'Voucher 42 has no document attached.',
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not overwrite an existing file', async () => {
      stubFetch({ objects: [voucherWithDocument] }, { objects: documentFile });
      const path = await tempPath();
      await writeFile(path, 'existing');
      await expect(
        documentCommand.action(
          { id: 42, output: path, json: false },
          undefined,
        ),
      ).rejects.toThrow('EEXIST');
      expect(await readFile(path, 'utf8')).toBe('existing');
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

    it('prints the service period', async () => {
      stubFetch({ objects: [voucher] });
      await getCommand.action({ id: 42, json: false }, undefined);
      expect(consola.info).toHaveBeenCalledWith(
        'Service period: 2024-01-01 – 2024-01-31',
      );
    });

    it('prints a dash when the voucher has no service period', async () => {
      stubFetch({
        objects: [{ ...voucher, deliveryDate: null, deliveryDateUntil: null }],
      });
      await getCommand.action({ id: 42, json: false }, undefined);
      expect(consola.info).toHaveBeenCalledWith('Service period: -');
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

    it('sends the service period', async () => {
      const path = await writeReceipt();
      const fetchMock = stubFetch(
        { objects: { filename: 'tmp-3.pdf' } },
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
          deliveryDate: '01.01.2024',
          deliveryDateUntil: '31.03.2024',
          json: false,
        },
        undefined,
      );
      const body = JSON.parse(requestAt(fetchMock, 1).init.body as string);
      expect(body.voucher).toMatchObject({
        deliveryDate: '01.01.2024',
        deliveryDateUntil: '31.03.2024',
      });
    });

    it('exits when --delivery-date-until is used without --delivery-date', async () => {
      const fetchMock = stubFetch();
      await expectExit(
        createCommand.action(
          {
            file: await writeReceipt(),
            status: 'open',
            creditDebit: 'C',
            taxRule: 9,
            accountDatev: 1600,
            amount: 119,
            net: false,
            taxRate: 19,
            supplierName: 'Acme GmbH',
            deliveryDateUntil: '31.03.2024',
            json: false,
          },
          undefined,
        ),
      );
      expect(consola.error).toHaveBeenCalledWith(
        'You must provide --delivery-date when using --delivery-date-until.',
      );
      expect(fetchMock).not.toHaveBeenCalled();
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
    it('books a negative amount on an expense voucher with --yes', async () => {
      const fetchMock = stubFetch(
        { objects: [{ ...voucher, creditDebit: 'C' }] },
        { objects: { fromStatus: '100', toStatus: '1000' } },
      );
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
      expect(requestAt(fetchMock, 0).url).toContain('/Voucher/42');
      const { url, init } = requestAt(fetchMock, 1);
      expect(url).toContain('/Voucher/42/bookAmount');
      expect(init.method).toBe('PUT');
      expect(JSON.parse(init.body as string)).toMatchObject({
        amount: -119,
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

    it('books a positive amount on a revenue voucher', async () => {
      const fetchMock = stubFetch(
        { objects: [{ ...voucher, creditDebit: 'D' }] },
        { objects: { fromStatus: '100', toStatus: '1000' } },
      );
      await bookCommand.action(
        {
          id: 42,
          amount: 119,
          date: '2024-02-01T00:00:00.000Z',
          type: 'FULL_PAYMENT',
          checkAccount: 3,
          yes: true,
          json: false,
        },
        undefined,
      );
      expect(
        JSON.parse(requestAt(fetchMock, 1).init.body as string),
      ).toMatchObject({ amount: 119 });
    });

    it('normalizes a negative amount to the sign of the voucher', async () => {
      const fetchMock = stubFetch(
        { objects: [{ ...voucher, creditDebit: 'C' }] },
        { objects: { fromStatus: '100', toStatus: '1000' } },
      );
      await bookCommand.action(
        {
          id: 42,
          amount: -119,
          date: '2024-02-01T00:00:00.000Z',
          type: 'FULL_PAYMENT',
          checkAccount: 3,
          yes: true,
          json: false,
        },
        undefined,
      );
      expect(
        JSON.parse(requestAt(fetchMock, 1).init.body as string),
      ).toMatchObject({ amount: -119 });
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

  describe('update', () => {
    it('sets the service period', async () => {
      const fetchMock = stubFetch({ objects: voucher });
      await updateCommand.action(
        {
          id: 42,
          deliveryDate: '01.01.2024',
          deliveryDateUntil: '31.01.2024',
          clearDeliveryDateUntil: false,
          json: false,
        },
        undefined,
      );
      const { url, init } = requestAt(fetchMock, 0);
      expect(url).toContain('/Voucher/42');
      expect(init.method).toBe('PUT');
      expect(JSON.parse(init.body as string)).toEqual({
        objectName: 'Voucher',
        mapAll: true,
        deliveryDate: '01.01.2024',
        deliveryDateUntil: '31.01.2024',
      });
      expect(consola.success).toHaveBeenCalledWith('Updated voucher 42.');
    });

    it('clears the end of the service period', async () => {
      const fetchMock = stubFetch({
        objects: { ...voucher, deliveryDateUntil: null },
      });
      await updateCommand.action(
        { id: 42, clearDeliveryDateUntil: true, json: true },
        undefined,
      );
      const { url, init } = requestAt(fetchMock, 0);
      expect(url).toContain('/Voucher/42');
      expect(init.method).toBe('PUT');
      expect(JSON.parse(init.body as string)).toEqual({
        objectName: 'Voucher',
        mapAll: true,
        deliveryDateUntil: null,
      });
      expect(
        JSON.parse(vi.mocked(console.log).mock.calls[0]?.[0]),
      ).toMatchObject({ id: '42', deliveryDateUntil: null });
    });

    it('rejects setting and clearing the end of the service period', async () => {
      const fetchMock = stubFetch();
      await expectExit(
        updateCommand.action(
          {
            id: 42,
            deliveryDateUntil: '31.01.2024',
            clearDeliveryDateUntil: true,
            json: false,
          },
          undefined,
        ),
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('open', () => {
    const draft = {
      ...voucher,
      status: '50',
      creditDebit: 'C',
      voucherType: 'VOU',
      taxRule: { id: '9', objectName: 'TaxRule' },
    };

    it('saves the draft with status 100 and its unchanged positions', async () => {
      const fetchMock = stubFetch(
        { objects: [draft] },
        { objects: [position] },
        { objects: { voucher: { ...draft, status: '100' }, voucherPos: [] } },
      );
      await openCommand.action({ id: 42, json: true }, undefined);
      expect(requestAt(fetchMock, 1).url).toContain('voucher%5Bid%5D=42');
      const save = requestAt(fetchMock, 2);
      expect(save.url).toContain('/Voucher/Factory/saveVoucher');
      expect(save.init.method).toBe('POST');
      expect(JSON.parse(save.init.body as string)).toEqual({
        voucher: {
          id: 42,
          objectName: 'Voucher',
          mapAll: true,
          status: 100,
          creditDebit: 'C',
          taxRule: { id: 9, objectName: 'TaxRule' },
          voucherType: 'VOU',
        },
        voucherPosSave: [
          {
            id: 1001,
            objectName: 'VoucherPos',
            mapAll: true,
            voucher: null,
            accountDatev: { id: 27, objectName: 'AccountDatev' },
            taxRate: 19,
            net: false,
            sumNet: 100,
            sumGross: 119,
          },
        ],
        voucherPosDelete: null,
      });
      expect(JSON.parse(vi.mocked(console.log).mock.calls[0]?.[0])).toEqual({
        id: '42',
        status: '100',
      });
    });

    it.each([
      ['an open voucher', { ...draft, status: '100' }],
      [
        'an enshrined draft',
        { ...draft, enshrined: '2024-02-01T00:00:00+01:00' },
      ],
    ])('refuses %s without saving', async (_, stored) => {
      const fetchMock = stubFetch({ objects: [stored] });
      await expectExit(openCommand.action({ id: 42, json: false }, undefined));
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('refuses legacy bookkeeping-1.0 positions without saving', async () => {
      const fetchMock = stubFetch(
        { objects: [draft] },
        { objects: [{ ...position, accountDatev: null }] },
      );
      await expectExit(openCommand.action({ id: 42, json: false }, undefined));
      expect(fetchMock).toHaveBeenCalledTimes(2);
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
