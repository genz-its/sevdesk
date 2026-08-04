import { consola } from 'consola';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import getCommand from '../src/commands/credit-notes/get';
import listCommand from '../src/commands/credit-notes/list';
import pdfCommand from '../src/commands/credit-notes/pdf';

const creditNote = {
  id: '42',
  objectName: 'CreditNote',
  creditNoteNumber: 'GS-1',
  contact: {
    id: '7',
    objectName: 'Contact',
    name: 'Acme GmbH',
    surename: null,
    familyname: null,
  },
  creditNoteDate: '2024-01-15T00:00:00+01:00',
  status: '200',
  sumNet: '100.00',
  sumTax: '19.00',
  sumGross: '119.00',
  currency: 'EUR',
};

const pdfContent = Buffer.from('%PDF-1.4 credit note');

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

describe('credit note commands', () => {
  beforeEach(() => {
    vi.stubEnv('SEVDESK_TOKEN', 'test-token');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(consola, 'info').mockImplementation(() => {});
    vi.spyOn(consola, 'success').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('builds the query and prints a table', async () => {
      const fetchMock = stubFetch({ objects: [creditNote] });
      await listCommand.action(
        {
          status: 200,
          creditNoteNumber: 'GS-1',
          startDate: '01.01.2024',
          endDate: '31.01.2024',
          contact: 7,
          limit: 10,
          json: false,
        },
        undefined,
      );
      const { url, init } = requestAt(fetchMock, 0);
      expect(init.method).toBe('GET');
      expect(url).toContain('/CreditNote?');
      expect(url).toContain('status=200');
      expect(url).toContain('creditNoteNumber=GS-1');
      expect(url).toContain('startDate=01.01.2024');
      expect(url).toContain('endDate=31.01.2024');
      expect(url).toContain('contact%5Bid%5D=7');
      expect(url).toContain('contact%5BobjectName%5D=Contact');
      expect(url).toContain('limit=10');
      expect(url).toContain('embed=contact');
      const output = vi.mocked(console.log).mock.calls.flat().join('\n');
      expect(output).toContain('NUMBER');
      expect(output).toContain('GS-1');
      expect(output).toContain('Acme GmbH');
      expect(output).toContain('119.00');
    });

    it('reports an empty result', async () => {
      stubFetch({ objects: [] });
      await listCommand.action({ json: false }, undefined);
      expect(consola.info).toHaveBeenCalledWith('No credit notes found.');
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  describe('get', () => {
    it('prints the credit note as JSON', async () => {
      const fetchMock = stubFetch({ objects: [creditNote] });
      await getCommand.action({ id: 42, json: true }, undefined);
      const { url } = requestAt(fetchMock, 0);
      expect(url).toContain('/CreditNote/42');
      expect(url).toContain('embed=contact');
      expect(JSON.parse(vi.mocked(console.log).mock.calls[0]?.[0])).toEqual(
        creditNote,
      );
    });
  });

  describe('pdf', () => {
    it('writes the decoded document to the output path', async () => {
      const fetchMock = stubFetch({
        objects: {
          filename: 'GS-1.pdf',
          mimeType: 'application/pdf',
          base64encoded: true,
          content: pdfContent.toString('base64'),
        },
      });
      const path = join(
        await mkdtemp(join(tmpdir(), 'sevdesk-cli-')),
        'credit-note.pdf',
      );
      await pdfCommand.action(
        { id: 42, output: path, preventSendBy: true, json: false },
        undefined,
      );
      const { url, init } = requestAt(fetchMock, 0);
      expect(init.method).toBe('GET');
      expect(url).toContain('/CreditNote/42/getPdf');
      expect(url).toContain('preventSendBy=true');
      expect(await readFile(path)).toEqual(pdfContent);
      expect(consola.success).toHaveBeenCalledWith(`Saved ${path}.`);
    });
  });
});
