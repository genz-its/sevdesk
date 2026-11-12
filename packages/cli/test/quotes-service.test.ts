import { SevDesk } from '@mi-skam/sevdesk-sdk';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyQuote } from '../src/quotes/model';
import {
  createQuote,
  exportQuote,
  loadQuote,
  resolveQuote,
  sendQuote,
} from '../src/quotes/service';
import { quoteFixture } from './quotes-fixtures';

const contact = {
  id: '7',
  name: 'Example customer',
  customerNumber: 'C-TEST',
  category: { id: '3' },
  status: '1000',
};
const address = {
  id: '9',
  contact: { id: '7' },
  street: 'Example Street 1',
  zip: '12345',
  city: 'Example City',
  country: { id: '1' },
};
const order = {
  id: '42',
  orderNumber: 'AN-TEST',
  orderType: 'AN',
  status: '100',
  sendDate: null,
  sumNet: '200',
  sumTax: '38',
  sumGross: '238',
};
function json(objects: unknown, status = 200) {
  return new Response(JSON.stringify({ objects }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('quote operations, mocked network only', () => {
  let dir: string;
  let receipt: string;
  let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
  let client: SevDesk;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'sevdesk-quotes-'));
    receipt = join(dir, 'receipt.json');
    fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/Contact'))
        return json(url.searchParams.get('offset') === '0' ? [contact] : []);
      if (url.pathname.endsWith('/Contact/7')) return json([contact]);
      if (url.pathname.endsWith('/ContactAddress'))
        return json(url.searchParams.get('offset') === '0' ? [address] : []);
      if (url.pathname.endsWith('/Order')) return json([]);
      if (url.pathname.endsWith('/saveOrder'))
        return json({ order, orderPos: [] });
      if (url.pathname.endsWith('/Order/42')) return json([order]);
      if (url.pathname.endsWith('/sendViaEmail') && init?.method === 'POST')
        return json([{ id: '99', to: 'customer@example.com' }]);
      throw new Error('Unexpected request: ' + url);
    });
    client = new SevDesk({ token: 'test-token', fetch: fetchMock });
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });
  const posts = () =>
    fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST');
  it('resolves an omitted quote number in shared service logic and keeps the caller draft unchanged', async () => {
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) => {
      if (String(input).includes('/SevSequence/Factory/getByType'))
        return json({
          id: '12',
          forObject: 'Order',
          type: 'AN',
          format: 'AN-%NUMBER',
          nextSequence: '2',
        });
      if (String(input).endsWith('/saveOrder'))
        return json({ order: { ...order, orderNumber: 'AN-2' }, orderPos: [] });
      return original(input, init);
    });
    const q = quoteFixture();
    delete q.document.number;
    const result = await createQuote(client, q, false, receipt);
    expect(posts()).toHaveLength(1);
    expect(JSON.parse(String(posts()[0]![1]?.body)).order.orderNumber).toBe(
      'AN-2',
    );
    expect((await loadQuote(result.draftFile!)).document.number).toBe('AN-2');
    expect(q.document.number).toBeUndefined();
  });
  it('resolves customer number and address without writes', async () => {
    const result = await resolveQuote(client, quoteFixture());
    expect(result.payload.order).toMatchObject({
      orderNumber: 'AN-TEST',
      contactId: 7,
      orderType: 'AN',
      status: 100,
      orderDate: '29.02.2024',
      address: 'Example customer\nExample Street 1\n12345 Example City',
      showNet: true,
    });
    expect(result.payload.order.footText).toContain('Gültig bis: 31.03.2024');
    expect(result.payload.order.headText).toContain('&lt;script&gt;');
    expect(posts()).toHaveLength(0);
  });
  it('selects an organization instead of its linked person for shared customer numbers', async () => {
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      if (
        url.pathname.endsWith('/Contact') &&
        url.searchParams.get('offset') === '0'
      )
        return json([contact, { ...contact, id: '11', parent: { id: '7' } }]);
      return original(input, init);
    });
    expect(
      (await resolveQuote(client, quoteFixture())).payload.order.contactId,
    ).toBe(7);
  });
  it('rejects ambiguous customer numbers', async () => {
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) =>
      String(input).includes('/Contact?')
        ? json(
            new URL(String(input)).searchParams.get('offset') === '0'
              ? [contact, { ...contact, id: '10' }]
              : [],
          )
        : original(input, init),
    );
    await expect(resolveQuote(client, quoteFixture())).rejects.toThrow(
      'ambiguous',
    );
  });
  it('supports document-only address override without contact writes', async () => {
    const q = quoteFixture();
    q.customer = { id: 7 };
    q.recipient = { address: 'Custom\nExample Address', countryId: 1 };
    expect((await resolveQuote(client, q)).payload.order.address).toBe(
      'Custom\nExample Address',
    );
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes('/ContactAddress'),
      ),
    ).toBe(false);
    expect(posts()).toHaveLength(0);
  });
  it('blocks a missing complete address', async () => {
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) =>
      String(input).includes('/ContactAddress?')
        ? json([])
        : original(input, init),
    );
    await expect(resolveQuote(client, quoteFixture())).rejects.toThrow(
      'complete recipient address',
    );
  });
  it('saves one draft without sending even if delivery is in the file', async () => {
    const result = await createQuote(client, quoteFixture(), false, receipt);
    expect(result).toMatchObject({
      state: 'saved',
      orderId: '42',
      totals: { gross: '238' },
    });
    expect(posts()).toHaveLength(1);
    const body = JSON.parse(String(posts()[0]![1]?.body));
    expect(body.order).toMatchObject({ status: 100, orderType: 'AN' });
    expect(body.orderPosSave[0]).toMatchObject({
      quantity: 2,
      price: 100,
      positionNumber: 0,
    });
    expect(JSON.parse(await readFile(receipt, 'utf8')).orderId).toBe('42');
    expect((await stat(receipt)).mode & 0o777).toBe(0o600);
    expect(result.draftFile).toBe(`${receipt}.quote.json`);
    expect(await loadQuote(result.draftFile!)).toEqual(quoteFixture());
    expect((await stat(result.draftFile!)).mode & 0o777).toBe(0o600);
  });
  it('writes a recoverable draft before the first creation POST', async () => {
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) => {
      if (String(input).endsWith('/saveOrder'))
        expect(await loadQuote(`${receipt}.quote.json`)).toEqual(
          quoteFixture(),
        );
      return original(input, init);
    });
    await createQuote(client, quoteFixture(), false, receipt);
    expect(posts()).toHaveLength(1);
  });
  it('never overwrites a recovery draft or makes a POST when its snapshot cannot be written', async () => {
    await writeFile(`${receipt}.quote.json`, 'existing');
    await expect(
      createQuote(client, quoteFixture(), false, receipt),
    ).rejects.toThrow();
    expect(posts()).toHaveLength(0);
    expect(await readFile(`${receipt}.quote.json`, 'utf8')).toBe('existing');
  });
  it('requires valid delivery before creating when send is requested', async () => {
    const q = quoteFixture();
    q.delivery = {};
    await expect(createQuote(client, q, true, receipt)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('saves then sends exactly once, substitutes number and escapes email text', async () => {
    const q = quoteFixture();
    q.delivery.message = 'Offer {{number}} <script>';
    const result = await createQuote(client, q, true, receipt);
    expect(result.state).toBe('sent');
    expect(posts()).toHaveLength(2);
    const body = JSON.parse(String(posts()[1]![1]?.body));
    expect(body).toMatchObject({
      toEmail: 'customer@example.com',
      subject: 'Angebot AN-TEST',
      ccEmail: 'copy@example.com',
      text: 'Offer AN-TEST &lt;script&gt;',
      copy: true,
    });
  });
  it('refuses duplicate quote numbers before writing', async () => {
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) =>
      new URL(String(input)).pathname.endsWith('/Order')
        ? json(
            new URL(String(input)).searchParams.get('offset') === '0'
              ? [order]
              : [],
          )
        : original(input, init),
    );
    await expect(
      createQuote(client, quoteFixture(), false, receipt),
    ).rejects.toThrow('already exists');
    expect(posts()).toHaveLength(0);
  });
  it('never overwrites an existing receipt', async () => {
    await writeFile(receipt, 'existing');
    await expect(
      createQuote(client, quoteFixture(), false, receipt),
    ).rejects.toThrow();
    expect(posts()).toHaveLength(0);
    expect(await readFile(receipt, 'utf8')).toBe('existing');
  });
  it('retains unknown creation state and never retries the POST', async () => {
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) => {
      if (String(input).endsWith('/saveOrder')) throw new Error('timeout');
      return original(input, init);
    });
    expect(
      (await createQuote(client, quoteFixture(), false, receipt)).state,
    ).toBe('creation-unknown');
    expect(posts()).toHaveLength(1);
    expect(JSON.parse(await readFile(receipt, 'utf8')).state).toBe(
      'creation-unknown',
    );
    expect(await loadQuote(`${receipt}.quote.json`)).toEqual(quoteFixture());
  });
  it('preserves saved ID on send failure, checks status and never resends', async () => {
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) => {
      if (String(input).endsWith('/sendViaEmail'))
        return json({ error: 'failed' }, 400);
      return original(input, init);
    });
    const result = await createQuote(client, quoteFixture(), true, receipt);
    expect(result).toMatchObject({ state: 'send-unknown', orderId: '42' });
    expect(result.message).toContain('Do not rerun quotes:create');
    expect(posts()).toHaveLength(2);
    expect(
      fetchMock.mock.calls.some(([input]) =>
        String(input).endsWith('/Order/42'),
      ),
    ).toBe(true);
  });
  it('checks ambiguous send timeouts and warns against resending when a send date exists', async () => {
    const original = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) => {
      if (String(input).endsWith('/sendViaEmail')) throw new Error('timeout');
      if (String(input).endsWith('/Order/42'))
        return json([{ ...order, status: '200', sendDate: '2024-02-29' }]);
      return original(input, init);
    });
    const result = await createQuote(client, quoteFixture(), true, receipt);
    expect(result.state).toBe('send-unknown');
    expect(result.message).toContain('do not resend');
    expect(posts()).toHaveLength(2);
  });
  it('sends an existing draft without creating another', async () => {
    const result = await sendQuote(
      client,
      42,
      quoteFixture().delivery as Parameters<typeof sendQuote>[2],
      receipt,
    );
    expect(result.state).toBe('sent');
    expect(posts()).toHaveLength(1);
    expect(String(posts()[0]![0])).toContain('/Order/42/sendViaEmail');
  });
  it('refuses resending a sent quote', async () => {
    fetchMock.mockResolvedValue(
      json([{ ...order, status: '200', sendDate: '2024-02-29' }]),
    );
    await expect(
      sendQuote(
        client,
        42,
        quoteFixture().delivery as Parameters<typeof sendQuote>[2],
        receipt,
      ),
    ).rejects.toThrow('already sent');
    expect(posts()).toHaveLength(0);
  });
  it('rejects oversized and malformed input files', async () => {
    const path = join(dir, 'oversized.json');
    await writeFile(path, ' '.repeat(1024 * 1024 + 1));
    await expect(loadQuote(path)).rejects.toThrow('1 MiB');
    await writeFile(path, '{');
    await expect(loadQuote(path)).rejects.toThrow();
  });
  it('exports incomplete drafts securely, round-trips and never overwrites', async () => {
    const path = join(dir, 'draft.json');
    await exportQuote(path, emptyQuote());
    expect(await loadQuote(path)).toEqual(emptyQuote());
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    await expect(exportQuote(path, quoteFixture())).rejects.toThrow();
    expect((await loadQuote(path)).customer).toBeNull();
  });
});
