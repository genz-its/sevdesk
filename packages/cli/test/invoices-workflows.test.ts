import { consola } from 'consola';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { processConfig } from 'zodline';
import deleteCommand from '../src/commands/invoices/delete';
import listCommand from '../src/commands/invoices/list';
import sendCommand from '../src/commands/invoices/send';
import updateCommand from '../src/commands/invoices/update';
import { isInteractive } from '../src/interactive';
import { promptConfirm } from '../src/prompt';

vi.mock('../src/interactive', () => ({ isInteractive: vi.fn(() => false) }));
vi.mock('../src/prompt', () => ({ promptConfirm: vi.fn() }));

const draft = {
  id: '9001',
  objectName: 'Invoice',
  invoiceNumber: 'RE-1',
  invoiceType: 'RE',
  invoiceDate: '2030-01-09T00:00:00+01:00',
  status: '100',
  contact: null,
  address: '',
  header: 'Rechnung Nr. RE-1',
  headText: '<p>Dear customer,</p>',
  footText: '<p>Kind regards</p>',
  timeToPay: '14',
  deliveryDate: '2029-12-07T00:00:00+01:00',
  deliveryDateUntil: null,
  sendDate: null,
  sendType: null,
  sumNet: '1000',
  sumGross: '1190',
  currency: 'EUR',
  showNet: '1',
};
const contact = {
  id: '1001',
  objectName: 'Contact',
  name: 'ACME Testbau GmbH',
};
const sent = {
  ...draft,
  id: '9002',
  invoiceNumber: 'RE-2',
  status: '200',
  sendType: 'VM',
  sendDate: '2030-01-09T10:02:42+01:00',
  contact,
};
const position = {
  id: '7001',
  objectName: 'InvoicePos',
  name: 'ACME maintenance 01/30',
  text: 'Invented service',
  quantity: '1',
  price: '1000',
  taxRate: '19',
  unity: { id: '1', objectName: 'Unity' },
  positionNumber: '0',
};
const delivery = {
  delivery: {
    to: 'billing@acme.example',
    subject: 'Rechnung Nr. {{number}}',
    message: 'Thank you for {{number}}.\nKind regards <ACME>',
    copyToSelf: true,
  },
};
const update = {
  invoice: {
    contactId: 1001,
    takeDefaultAddress: true,
    headText: '<p>ACME introduction</p>',
  },
  positions: [
    {
      name: position.name,
      text: position.text,
      quantity: 1,
      price: 1000,
      taxRate: 19,
      unityId: 1,
    },
  ],
};
const commands = {
  'invoices:send': sendCommand,
  'invoices:update': updateCommand,
  'invoices:delete': deleteCommand,
  'invoices:list': listCommand,
};
async function run(...args: string[]) {
  const parsed = processConfig({ commands }, args);
  await parsed.command.action(parsed.options, parsed.args);
}
function response(objects: unknown) {
  return new Response(JSON.stringify({ objects }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('invoice draft workflows', () => {
  let dir: string, deliveryFile: string, updateFile: string, receipt: string;
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sevdesk-invoices-'));
    deliveryFile = join(dir, 'delivery.json');
    updateFile = join(dir, 'invoice.json');
    receipt = join(dir, 'receipt.json');
    await writeFile(deliveryFile, JSON.stringify(delivery));
    await writeFile(updateFile, JSON.stringify(update));
    vi.stubEnv('SEVDESK_TOKEN', 'test-token');
    vi.stubEnv('XDG_STATE_HOME', dir);
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(isInteractive).mockReturnValue(false);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(consola, 'info').mockImplementation(() => {});
    vi.spyOn(consola, 'success').mockImplementation(() => {});
    vi.spyOn(consola, 'error').mockImplementation(() => {});
    fetchMock.mockImplementation(async () => response([draft]));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    process.exitCode = 0;
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });
  const output = () =>
    JSON.parse(vi.mocked(console.log).mock.calls.at(-1)?.[0]);
  const writes = () =>
    fetchMock.mock.calls.filter(([, init]) => init?.method !== 'GET');
  const requestBody = () => JSON.parse(String(writes()[0]?.[1]?.body));

  it('fetches then sends once, substitutes the number, prints stored acknowledgement and writes a private receipt', async () => {
    fetchMock
      .mockResolvedValueOnce(response([draft]))
      .mockResolvedValueOnce(
        response({
          id: '5001',
          objectName: 'Email',
          object: { ...sent, id: draft.id, invoiceNumber: draft.invoiceNumber },
        }),
      );
    await run(
      'invoices:send',
      '9001',
      deliveryFile,
      '--yes',
      '--json',
      '--receipt',
      receipt,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      '/Invoice/9001?embed=contact',
    );
    expect(String(writes()[0]?.[0])).toContain('/Invoice/9001/sendViaEmail');
    expect(writes()[0]?.[1]?.method).toBe('POST');
    expect(requestBody()).toEqual({
      toEmail: 'billing@acme.example',
      subject: 'Rechnung Nr. RE-1',
      text: 'Thank you for RE-1.<br>Kind regards &lt;ACME&gt;',
      copy: true,
    });
    expect(output()).toMatchObject({
      state: 'sent',
      invoiceNumber: 'RE-1',
      status: '200',
      sendType: 'VM',
      sendDate: sent.sendDate,
    });
    expect(JSON.parse(await readFile(receipt, 'utf8')).state).toBe('sent');
    expect((await stat(receipt)).mode & 0o777).toBe(0o600);
  });
  it.each([
    sent,
    { ...draft, sendDate: sent.sendDate },
    { ...draft, status: '1000' },
    { ...draft, enshrined: sent.sendDate },
  ])(
    'never sends an already-sent or immutable invoice: %j',
    async (invoice) => {
      fetchMock.mockResolvedValueOnce(response([invoice]));
      await expect(
        run('invoices:send', invoice.id, deliveryFile, '--yes'),
      ).rejects.toThrow(/already sent/);
      expect(writes()).toHaveLength(0);
    },
  );
  it.each(['invoices:send', 'invoices:update'])(
    '%s dry-run is offline, even without authentication',
    async (cmd) => {
      vi.stubEnv('SEVDESK_TOKEN', '');
      await run(
        cmd,
        '9001',
        cmd.endsWith('send') ? deliveryFile : updateFile,
        '--dry-run',
        '--json',
      );
      expect(fetchMock).not.toHaveBeenCalled();
      expect(output()).toMatchObject({ dryRun: true, accountValidated: false });
    },
  );
  it.each(['invoices:send', 'invoices:update', 'invoices:delete'])(
    '%s refuses non-interactive writes without --yes',
    async (cmd) => {
      vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('exit 1');
      });
      const args = [cmd, '9001'];
      if (!cmd.endsWith('delete'))
        args.push(cmd.endsWith('send') ? deliveryFile : updateFile);
      await expect(run(...args)).rejects.toThrow('exit 1');
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(writes()).toHaveLength(0);
    },
  );
  it('shows invoice identity, contact, gross amount and recipient in the send confirmation; declining does not write', async () => {
    vi.mocked(isInteractive).mockReturnValue(true);
    vi.mocked(promptConfirm).mockResolvedValue(false);
    fetchMock.mockResolvedValueOnce(response([{ ...draft, contact }]));
    await run('invoices:send', '9001', deliveryFile);
    expect(promptConfirm).toHaveBeenCalledWith(
      expect.stringMatching(
        /RE-1.*ACME Testbau GmbH.*1190 EUR.*billing@acme.example/,
      ),
      false,
    );
    expect(writes()).toHaveLength(0);
  });
  it('preserves an unknown send outcome in the receipt without retrying the POST', async () => {
    fetchMock
      .mockResolvedValueOnce(response([draft]))
      .mockRejectedValueOnce(new Error('network lost'))
      .mockResolvedValueOnce(response([{ ...sent, id: '9001' }]));
    await run(
      'invoices:send',
      '9001',
      deliveryFile,
      '--yes',
      '--json',
      '--receipt',
      receipt,
    );
    expect(writes()).toHaveLength(1);
    expect(output()).toMatchObject({
      state: 'send-unknown',
      status: '200',
      sendDate: sent.sendDate,
    });
    expect(process.exitCode).toBe(1);
    expect(JSON.parse(await readFile(receipt, 'utf8')).state).toBe(
      'send-unknown',
    );
  });
  it('does not send if the receipt already exists', async () => {
    await writeFile(receipt, 'existing receipt');
    await expect(
      run('invoices:send', '9001', deliveryFile, '--yes', '--receipt', receipt),
    ).rejects.toThrow();
    expect(writes()).toHaveLength(0);
    expect(await readFile(receipt, 'utf8')).toBe('existing receipt');
  });
  it('replaces every old position, saves partial fields, re-reads and prints stored state', async () => {
    const stored = { ...draft, contact, headText: update.invoice.headText };
    fetchMock
      .mockResolvedValueOnce(response([draft]))
      .mockResolvedValueOnce(response([position]))
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(
        response({
          invoice: stored,
          invoicePos: [{ ...position, id: '7002' }],
        }),
      )
      .mockResolvedValueOnce(response([stored]));
    await run('invoices:update', '9001', updateFile, '--yes', '--json');
    expect(writes()).toHaveLength(1);
    expect(requestBody()).toEqual({
      invoice: {
        id: 9001,
        objectName: 'Invoice',
        mapAll: true,
        contact: { id: 1001, objectName: 'Contact' },
        headText: update.invoice.headText,
      },
      invoicePosSave: [
        {
          objectName: 'InvoicePos',
          mapAll: true,
          invoice: null,
          name: position.name,
          text: position.text,
          quantity: 1,
          price: 1000,
          taxRate: 19,
          unity: { id: 1, objectName: 'Unity' },
          positionNumber: 0,
        },
      ],
      invoicePosDelete: [{ id: 7001, objectName: 'InvoicePos' }],
      discountSave: null,
      discountDelete: null,
      takeDefaultAddress: true,
    });
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toContain(
      '/Invoice/9001?embed=contact',
    );
    expect(output()).toEqual(stored);
  });
  it('updates only headText without reading or mutating positions', async () => {
    await writeFile(
      updateFile,
      JSON.stringify({ invoice: { headText: 'ACME new intro' } }),
    );
    fetchMock
      .mockResolvedValueOnce(response([draft]))
      .mockResolvedValueOnce(response({ invoice: draft, invoicePos: [] }))
      .mockResolvedValueOnce(
        response([{ ...draft, headText: 'ACME stored intro' }]),
      );
    await run('invoices:update', '9001', updateFile, '--yes', '--json');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(requestBody()).toEqual({
      invoice: {
        id: 9001,
        objectName: 'Invoice',
        mapAll: true,
        headText: 'ACME new intro',
      },
      invoicePosDelete: null,
      discountSave: null,
      discountDelete: null,
    });
    expect(output().headText).toBe('ACME stored intro');
  });
  it.each(['invoices:update', 'invoices:delete'])(
    '%s refuses finalised invoices',
    async (cmd) => {
      fetchMock.mockResolvedValueOnce(response([sent]));
      await expect(
        run(
          cmd,
          '9002',
          ...(cmd.endsWith('update') ? [updateFile] : []),
          '--yes',
        ),
      ).rejects.toThrow(/GoBD.*credit note or cancellation/);
      expect(writes()).toHaveLength(0);
    },
  );
  it.each([
    { invoiceDate: '2030-01-09', deliveryDate: '2030-01-10' },
    { deliveryDate: '2030-01-09', deliveryDateUntil: '2030-01-08' },
    { invoiceDate: '2030-01-09', deliveryDateUntil: '2030-01-10' },
    { invoiceDate: '2030-02-30' },
  ])('validates supplied dates before networking: %j', async (invoice) => {
    await writeFile(updateFile, JSON.stringify({ invoice }));
    await expect(
      run('invoices:update', '9001', updateFile, '--yes'),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('validates changed dates against omitted stored dates before saving', async () => {
    await writeFile(
      updateFile,
      JSON.stringify({ invoice: { invoiceDate: '2029-12-01' } }),
    );
    await expect(
      run('invoices:update', '9001', updateFile, '--yes'),
    ).rejects.toThrow(/service date after/);
    expect(writes()).toHaveLength(0);
  });
  it('supports top-level takeDefaultAddress without injecting defaults', async () => {
    await writeFile(
      updateFile,
      JSON.stringify({
        invoice: { contactId: 1001 },
        takeDefaultAddress: true,
      }),
    );
    fetchMock
      .mockResolvedValueOnce(response([draft]))
      .mockResolvedValueOnce(response({ invoice: draft, invoicePos: [] }))
      .mockResolvedValueOnce(response([{ ...draft, contact }]));
    await run('invoices:update', '9001', updateFile, '--yes');
    expect(requestBody().takeDefaultAddress).toBe(true);
    expect(requestBody().invoice).not.toHaveProperty('status');
    expect(requestBody().invoice).not.toHaveProperty('discount');
  });
  it('deletes an unsent draft and prints its identity', async () => {
    fetchMock
      .mockResolvedValueOnce(response([draft]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    await run('invoices:delete', '9001', '--yes', '--json');
    expect(writes()[0]?.[1]?.method).toBe('DELETE');
    expect(String(writes()[0]?.[0])).toContain('/Invoice/9001');
    expect(output()).toEqual({
      deleted: true,
      invoiceId: '9001',
      invoiceNumber: 'RE-1',
    });
  });
  it('lists drafts and emits duplicate warnings on stderr and in JSON', async () => {
    fetchMock
      .mockResolvedValueOnce(
        response([
          { ...draft, id: '9003', invoiceNumber: 'RE-3', sumNet: '15' },
          { ...draft, id: '9004', invoiceNumber: 'RE-3', sumNet: '1340' },
          sent,
        ]),
      )
      .mockResolvedValueOnce(response([]));
    await run('invoices:list', '--drafts', '--json');
    expect(output().invoices.map((i: { id: string }) => i.id)).toEqual([
      '9003',
      '9004',
    ]);
    expect(output().warnings).toEqual([
      expect.stringMatching(/RE-3.*9003.*9004/),
    ]);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/RE-3.*9003.*9004/),
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('status=100');
  });
  it('filters status client-side before applying limit, across short pages', async () => {
    fetchMock
      .mockResolvedValueOnce(response([draft]))
      .mockResolvedValueOnce(response([sent]));
    await run('invoices:list', '--status', '200', '--limit', '1', '--json');
    expect(output()).toEqual([sent]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('offset=1');
  });
  it('returns an empty warnings array for drafts without duplicates', async () => {
    fetchMock.mockResolvedValueOnce(response([]));
    await run('invoices:list', '--drafts', '--json');
    expect(output()).toEqual({ invoices: [], warnings: [] });
  });
  it('rejects conflicting draft/status filters and invalid statuses offline', async () => {
    await expect(
      run('invoices:list', '--drafts', '--status', '200'),
    ).rejects.toThrow(/cannot be combined/);
    await expect(run('invoices:list', '--status', '123')).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
