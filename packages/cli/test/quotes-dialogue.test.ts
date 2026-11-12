import type { SevDesk } from '@mi-skam/sevdesk-sdk';
import { consola } from 'consola';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assertNumberAvailable, nextNumber } from '../src/numbering';
import {
  quoteDialogue,
  terminalUI,
  type QuoteUI,
} from '../src/quotes/dialogue';
import type { QuoteDraft } from '../src/quotes/model';
import {
  addresses,
  customers,
  exportQuote,
  resolveQuote,
} from '../src/quotes/service';
import { quoteFixture } from './quotes-fixtures';

vi.mock('../src/numbering', () => ({
  nextNumber: vi.fn(),
  assertNumberAvailable: vi.fn(),
}));
vi.mock('../src/quotes/service', () => ({
  customers: vi.fn(),
  addresses: vi.fn(),
  exportQuote: vi.fn(),
  resolveQuote: vi.fn(),
  addressText: vi.fn(() => 'ACME\nExample Street'),
}));
async function cancel(): Promise<never> {
  const spy = vi
    .spyOn(consola, 'prompt')
    .mockResolvedValueOnce(Symbol.for('cancel'));
  try {
    await terminalUI.text('Cancel test input');
  } finally {
    spy.mockRestore();
  }
  throw new Error('Cancellation did not throw');
}
function scripted(
  actions: string[],
  texts: string[] = [],
  confirmations: boolean[] = [],
) {
  const prompts: string[] = [],
    output: string[] = [];
  const menus: {
    message: string;
    choices: { value: string; label: string }[];
    initial?: string;
  }[] = [];
  const inputs: { message: string; initial?: string }[] = [];
  const ui: QuoteUI = {
    async choose(message, choices, initial) {
      prompts.push(message);
      menus.push({ message, choices, initial });
      const next = actions.shift();
      if (next === '^C') return cancel();
      if (!next || !choices.some((choice) => choice.value === next))
        throw new Error('Invalid scripted choice ' + next + ' at ' + message);
      return next;
    },
    async text(message, initial) {
      prompts.push(message);
      inputs.push({ message, initial });
      if (!texts.length) throw new Error('Missing scripted text: ' + message);
      const value = texts.shift()!;
      return value === '^C' ? cancel() : value;
    },
    async confirm(message) {
      prompts.push(message);
      return confirmations.shift() ?? false;
    },
    show(message) {
      if (/^(Invalid scripted|Missing scripted)/.test(message))
        throw new Error(message);
      output.push(message);
    },
  };
  return { ui, prompts, output, menus, inputs, remaining: actions };
}
const client = async () => ({}) as SevDesk;
let exported: QuoteDraft[];
async function editAndExport(
  actions: string[],
  texts: string[],
  quote = quoteFixture(),
) {
  const s = scripted([...actions, 'export', 'cancel'], [...texts, 'new.json']);
  await quoteDialogue(client, quote, s.ui);
  expect(s.remaining).toEqual([]);
  return { ...s, quote: exported.at(-1)! };
}
const contact = {
  id: '7',
  customerNumber: 'C-TEST',
  name: 'ACME',
  status: '1000',
};
describe('value-connected quote editor (no live account)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    exported = [];
    vi.mocked(nextNumber).mockResolvedValue({
      kind: 'quote',
      format: 'AN-%NUMBER',
      configuredCounter: '2',
      highestExistingNumber: 'AN-2',
      nextNumber: 'AN-3',
      reserved: false,
    });
    vi.mocked(assertNumberAvailable).mockResolvedValue(undefined);
    vi.mocked(customers).mockResolvedValue([]);
    vi.mocked(addresses).mockResolvedValue([]);
    vi.mocked(exportQuote).mockImplementation(async (_path, quote) => {
      exported.push(structuredClone(quote));
    });
    vi.mocked(resolveQuote).mockResolvedValue({
      customer: { id: '7', name: 'ACME' },
      payload: { order: { address: 'Example Street' } },
    } as Awaited<ReturnType<typeof resolveQuote>>);
  });
  it('opens imports directly in a single editor with values on selectable rows', async () => {
    const s = scripted(['cancel']);
    await quoteDialogue(client, quoteFixture(), s.ui);
    const menu = s.menus[0]!;
    expect(menu.message).toContain('Quote editor');
    expect(menu.message).toContain('Total (Gesamtbetrag): 238.00 EUR');
    expect(menu.initial).toBe('position:0');
    expect(
      menu.choices.find((row) => row.value === 'document:heading')?.label,
    ).toContain('Example offer');
    expect(
      menu.choices.find((row) => row.value === 'position:0')?.label,
    ).toContain('2 hours × 100.00 EUR');
    expect(menu.choices.map((row) => row.value)).not.toEqual(
      expect.arrayContaining(['review', 'details', 'texts']),
    );
    expect(
      s.prompts.some((message) => message.startsWith('Search customer')),
    ).toBe(false);
  });
  it('resolves the loaded customer name without changing the draft or recipients', async () => {
    vi.mocked(customers).mockResolvedValue([contact] as never);
    const s = scripted(['cancel']);
    await quoteDialogue(client, quoteFixture(), s.ui);
    expect(s.menus[0]!.choices[0]!.label).toContain('ACME');
    expect(exportQuote).not.toHaveBeenCalled();
  });
  it('accepts a heading edit directly, restores the same cursor, and leaves the input draft untouched', async () => {
    const original = quoteFixture();
    const result = await editAndExport(
      ['document:heading'],
      ['New heading'],
      original,
    );
    expect(result.quote.document.heading).toBe('New heading');
    expect(original.document.heading).toBe('Example offer');
    expect(result.menus[1]!.initial).toBe('document:heading');
    expect(result.prompts).not.toContain('Quote details (Angebotsdaten)');
  });
  it('clears optional multiline text without an Apply or Terms screen', async () => {
    const result = await editAndExport(['texts:introduction'], ['']);
    expect(result.quote.texts.introduction).toBeUndefined();
    expect(result.quote.terms).toEqual(quoteFixture().terms);
    expect(result.prompts).not.toContain('Terms (Bedingungen)');
  });
  it('supports multiline text and terms independently', async () => {
    const result = await editAndExport(
      ['texts:closing', 'terms:payment'],
      ['Thanks\\nACME', '30 days'],
    );
    expect(result.quote.texts.closing).toBe('Thanks\nACME');
    expect(result.quote.terms.payment).toBe('30 days');
  });
  it('validates only the selected field and retains invalid input for correction', async () => {
    const result = await editAndExport(
      ['document:currency'],
      ['not-currency', 'USD'],
    );
    expect(result.quote.document.currency).toBe('USD');
    expect(result.inputs[1]!.initial).toBe('not-currency');
    expect(result.output.join('\n')).toContain('Currency (Währung)');
  });
  it('cancels one field without exiting or changing it', async () => {
    const result = await editAndExport(['document:heading'], ['^C']);
    expect(result.quote.document.heading).toBe('Example offer');
    expect(result.prompts).not.toContain(
      'Unsaved changes (Ungespeicherte Änderungen)',
    );
  });
  it('shows missing requirements on their actual rows and focuses the first error on save', async () => {
    const quote = quoteFixture();
    delete quote.document.heading;
    const s = scripted(['save', 'cancel']);
    await quoteDialogue(client, quote, s.ui);
    expect(
      s.menus[0]!.choices.find((row) => row.value === 'document:heading')
        ?.label,
    ).toMatch(/^⚠ .*Betreff.*—/);
    expect(s.menus[1]!.initial).toBe('document:heading');
    expect(s.output.join('\n')).toContain('Subject (Betreff)');
    expect(s.output.join('\n')).not.toMatch(
      /document\.|contactPersonId|ruleId/,
    );
    expect(resolveQuote).not.toHaveBeenCalled();
  });
  it('does not validate unrelated missing fields while editing one field', async () => {
    const quote = quoteFixture();
    quote.document = {};
    const result = await editAndExport(
      ['document:contactPersonId'],
      ['9'],
      quote,
    );
    expect(result.quote.document.contactPersonId).toBe(9);
    expect(result.quote.document.date).toBeUndefined();
  });
  it('starts new quotes with customer search then the editor, without chained details', async () => {
    const s = scripted(['empty', 'export', 'cancel'], ['', 'new.json']);
    await quoteDialogue(client, undefined, s.ui);
    expect(s.prompts[0]).toContain('Search customer');
    expect(s.prompts[2]).toContain('Quote editor');
    expect(exported[0]!.customer).toBeNull();
    expect(exported[0]!.document.number).toBe('AN-3');
    expect(exported[0]!.document.heading).toBe('Angebot Nr. AN-3');
    expect(exported[0]!.document.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it('keeps generated headings in sync with direct number edits', async () => {
    const s = scripted(
      ['empty', 'document:number', 'export', 'cancel'],
      ['', 'AN-8', 'new.json'],
    );
    await quoteDialogue(client, undefined, s.ui);
    expect(exported[0]!.document.heading).toBe('Angebot Nr. AN-8');
  });
  it('does not replace custom headings on number changes', async () => {
    const result = await editAndExport(['document:number'], ['AN-8']);
    expect(result.quote.document.heading).toBe('Example offer');
  });
  it('resolves an imported automatic number only on an otherwise valid save', async () => {
    const quote = quoteFixture();
    delete quote.document.number;
    const s = scripted(['save'], [], [true]);
    const result = await quoteDialogue(client, quote, s.ui);
    expect(result?.quote.document.number).toBe('AN-3');
    expect(result?.quote.document.heading).toBe('Example offer');
    expect(nextNumber).toHaveBeenCalledTimes(1);
  });
  it('does not resolve automatic numbers for locally incomplete saves', async () => {
    const quote = quoteFixture();
    delete quote.document.number;
    quote.tax = {};
    const s = scripted(['save', 'cancel']);
    await quoteDialogue(client, quote, s.ui);
    expect(nextNumber).not.toHaveBeenCalled();
  });
  it('requires explicit number refresh after a collision', async () => {
    vi.mocked(assertNumberAvailable).mockRejectedValueOnce(
      new Error('Quote number already exists'),
    );
    const s = scripted(['save', 'number', 'save'], [], [true]);
    const result = await quoteDialogue(client, quoteFixture(), s.ui);
    expect(result?.quote.document.number).toBe('AN-3');
    expect(nextNumber).toHaveBeenCalledTimes(1);
    expect(s.output.join('\n')).toContain('already exists');
  });
  it('preserves explicit numbers and requires a final remote-save confirmation', async () => {
    const s = scripted(['save'], [], [true]);
    const result = await quoteDialogue(client, quoteFixture(), s.ui);
    expect(result?.quote.document.number).toBe('AN-TEST');
    expect(result?.send).toBe(false);
    expect(nextNumber).not.toHaveBeenCalled();
    expect(s.prompts.at(-1)).toContain('Save draft in sevdesk?');
  });
  it('returns to the same save row when remote saving is declined', async () => {
    const s = scripted(['save', 'cancel'], [], [false]);
    expect(await quoteDialogue(client, quoteFixture(), s.ui)).toBeUndefined();
    expect(s.menus[1]!.initial).toBe('save');
  });
  it('opens a position directly into value rows, with immediate edits and updated totals', async () => {
    const result = await editAndExport(
      ['position:0', 'unitPrice', 'done'],
      ['150'],
    );
    expect(result.quote.positions[0]!.unitPrice).toBe('150');
    expect(result.menus[1]!.message).toContain('Position 1 · Consulting');
    expect(
      result.menus[1]!.choices.find((row) => row.value === 'unitPrice')?.label,
    ).toContain('100.00');
    expect(
      result.menus[2]!.choices.find((row) => row.value === 'unitPrice')?.label,
    ).toContain('150');
    expect(result.menus[3]!.message).toContain(
      'Total (Gesamtbetrag): 357.00 EUR',
    );
    expect(
      result.menus.every(
        (menu) =>
          !menu.choices.some(
            (row) => row.value === 'apply' || row.value === 'edit',
          ),
      ),
    ).toBe(true);
  });
  it('retains accepted position edits when a later field and then the position screen are cancelled', async () => {
    const result = await editAndExport(
      ['position:0', 'unitPrice', 'name', '^C'],
      ['150', '^C'],
    );
    expect(result.quote.positions[0]!.unitPrice).toBe('150');
    expect(result.quote.positions[0]!.name).toBe('Consulting');
  });
  it('rejects invalid position input inline and allows correction', async () => {
    const result = await editAndExport(
      ['position:0', 'quantity', 'done'],
      ['0', '3'],
    );
    expect(result.quote.positions[0]!.quantity).toBe('3');
    expect(result.inputs[1]!.initial).toBe('0');
    expect(result.output.join('\n')).toContain('Must be positive');
  });
  it('shows the current boolean selection and excludes optional positions from totals', async () => {
    const result = await editAndExport(
      ['position:0', 'optional', 'true', 'done'],
      [],
    );
    expect(result.quote.positions[0]!.optional).toBe(true);
    expect(
      result.menus.find(
        (menu) => menu.message === 'Optional position (Optionale Position)',
      )?.initial,
    ).toBe('false');
    expect(result.menus.at(-2)!.message).toContain(
      'Total (Gesamtbetrag): 0.00 EUR',
    );
  });
  it('duplicates, moves, removes, and restores positions at the removed index', async () => {
    const result = await editAndExport(
      [
        'position:0',
        'duplicate',
        'position:1',
        'up',
        'position:0',
        'remove',
        'undo',
      ],
      [],
    );
    expect(result.quote.positions).toHaveLength(2);
    expect(result.quote.positions[0]).toEqual(result.quote.positions[1]);
    const first = result.menus[1]!;
    expect(first.choices.map((row) => row.value)).not.toContain('up');
    expect(first.choices.map((row) => row.value)).not.toContain('down');
    expect(
      result.menus
        .find((menu) => menu.choices.some((row) => row.value === 'undo'))
        ?.choices.find((row) => row.value === 'undo')?.label,
    ).toContain('Consulting');
  });
  it('adds a staged custom position only after it is complete', async () => {
    const result = await editAndExport(
      ['add', 'custom', 'unitId', 'vatRate', 'done'],
      ['ACME setup', '1', '19'],
    );
    expect(result.quote.positions).toHaveLength(2);
    expect(result.quote.positions[1]).toMatchObject({
      name: 'ACME setup',
      quantity: '1',
      unitPrice: '0',
      vatRate: '19',
      unit: { id: 1 },
    });
  });
  it('can discard an unfinished new position without changing existing positions', async () => {
    const s = scripted(
      ['add', 'custom', 'name', '^C', 'export', 'cancel'],
      ['New position', 'Changed name', 'new.json'],
      [true],
    );
    await quoteDialogue(client, quoteFixture(), s.ui);
    expect(exported[0]!.positions).toEqual(quoteFixture().positions);
    expect(s.prompts).toContain(
      'Discard unfinished entry? (Unvollständigen Eintrag verwerfen?)',
    );
  });
  it('keeps existing pricing by default when a net/gross change is cancelled', async () => {
    const result = await editAndExport(
      ['document:priceMode', 'gross', 'cancel'],
      [],
    );
    expect(result.quote.document.priceMode).toBe('net');
    expect(result.quote.positions[0]!.unitPrice).toBe('100.00');
    expect(
      result.menus.find((menu) => menu.message.startsWith('Changing net/gross'))
        ?.initial,
    ).toBe('cancel');
  });
  it('converts prices explicitly and preserves gross totals', async () => {
    const result = await editAndExport(
      ['document:priceMode', 'gross', 'convert'],
      [],
    );
    expect(result.quote.document.priceMode).toBe('gross');
    expect(result.quote.positions[0]!.unitPrice).toBe('119.0000');
  });
  it('supports deliberate reinterpretation without converting entered prices', async () => {
    const result = await editAndExport(
      ['document:priceMode', 'gross', 'reinterpret'],
      [],
    );
    expect(result.quote.document.priceMode).toBe('gross');
    expect(result.quote.positions[0]!.unitPrice).toBe('100.00');
  });
  it('preserves address and email recipients when reselecting the same customer', async () => {
    vi.mocked(customers).mockResolvedValue([contact] as never);
    const quote = quoteFixture();
    quote.recipient = { address: 'ACME\nCustom Street', countryId: 1 };
    const result = await editAndExport(['customer', '7', 'later'], [''], quote);
    expect(result.quote.recipient).toEqual(quote.recipient);
    expect(result.quote.delivery).toEqual(quote.delivery);
  });
  it('clears old recipients and address when switching to no customer', async () => {
    const quote = quoteFixture();
    quote.recipient = { address: 'ACME', countryId: 1 };
    const result = await editAndExport(['customer', 'empty'], [''], quote);
    expect(result.quote.customer).toBeNull();
    expect(result.quote.recipient).toBeUndefined();
    expect(result.quote.delivery.to).toBeUndefined();
    expect(result.quote.delivery.cc).toBeUndefined();
    expect(result.quote.delivery.bcc).toBeUndefined();
  });
  it('warns about address-only changes and can return without losing them', async () => {
    const quote = quoteFixture();
    quote.recipient = { address: 'ACME\nOld Street', countryId: 1 };
    const s = scripted(
      ['recipient', 'address', 'done', 'cancel', 'back', 'export', 'cancel'],
      ['ACME\\nNew Street', 'new.json'],
    );
    await quoteDialogue(client, quote, s.ui);
    expect(exported[0]!.recipient?.address).toBe('ACME\nNew Street');
    expect(s.prompts).toContain('Unsaved changes (Ungespeicherte Änderungen)');
  });
  it('allows an unchanged direct edit to exit without a dirty warning', async () => {
    const s = scripted(['document:heading', 'cancel'], ['Example offer']);
    await quoteDialogue(client, quoteFixture(), s.ui);
    expect(s.prompts).not.toContain(
      'Unsaved changes (Ungespeicherte Änderungen)',
    );
  });
  it('requires explicit email review and final confirmation, preserving multiline text', async () => {
    const s = scripted(['send', 'message', 'done'], ['Hello\\nACME'], [true]);
    const result = await quoteDialogue(client, quoteFixture(), s.ui);
    expect(result?.send).toBe(true);
    expect(result?.quote.delivery.message).toBe('Hello\nACME');
    expect(s.output.join('\n')).toContain('Attachment (Anhang): Quote PDF');
    expect(s.output.join('\n')).toContain('copy@example.com');
    expect(s.prompts.at(-1)).toContain('Save and send now?');
  });
  it('declining email confirmation returns directly to the editor without sending', async () => {
    const s = scripted(['send', 'done', 'cancel'], [], [false]);
    expect(await quoteDialogue(client, quoteFixture(), s.ui)).toBeUndefined();
    expect(s.menus.at(-1)!.message).toContain('Quote editor');
  });
  it('can retry customer loading failures without inventing a customer', async () => {
    vi.mocked(customers).mockRejectedValueOnce(
      new Error('Network unavailable'),
    );
    const s = scripted(
      ['retry', 'empty', 'export', 'cancel'],
      ['', 'new.json'],
    );
    await quoteDialogue(client, undefined, s.ui);
    expect(exported[0]!.customer).toBeNull();
    expect(s.output.join('\n')).toContain('Network unavailable');
  });
  it('restores a distinct removed position at its original index', async () => {
    const quote = quoteFixture();
    quote.positions.push({
      ...structuredClone(quote.positions[0]!),
      name: 'Second service',
    });
    const result = await editAndExport(
      ['position:1', 'remove', 'undo'],
      [],
      quote,
    );
    expect(result.quote.positions.map((position) => position.name)).toEqual([
      'Consulting',
      'Second service',
    ]);
    expect(result.menus.at(-2)!.initial).toBe('position:1');
  });
  it('supports downward movement without losing the selected position', async () => {
    const quote = quoteFixture();
    quote.positions.push({
      ...structuredClone(quote.positions[0]!),
      name: 'Second service',
    });
    const result = await editAndExport(['position:0', 'down'], [], quote);
    expect(result.quote.positions.map((position) => position.name)).toEqual([
      'Second service',
      'Consulting',
    ]);
    expect(result.menus.at(-2)!.initial).toBe('position:1');
  });
  it('creates a local recipient override only once all address fields are valid', async () => {
    const result = await editAndExport(
      ['recipient', 'address', 'countryId', 'done'],
      ['ACME\\nSome Street', '1'],
    );
    expect(result.quote.recipient).toEqual({
      address: 'ACME\nSome Street',
      countryId: 1,
    });
  });
  it('keeps an unfinished new address staged and can explicitly discard it', async () => {
    const s = scripted(
      ['recipient', 'address', '^C', 'export', 'cancel'],
      ['ACME', 'new.json'],
      [true],
    );
    await quoteDialogue(client, quoteFixture(), s.ui);
    expect(exported[0]!.recipient).toBeUndefined();
    expect(s.prompts).toContain(
      'Discard unfinished entry? (Unvollständigen Eintrag verwerfen?)',
    );
  });
  it('can export and exit when accepted edits are unsaved', async () => {
    const s = scripted(
      ['document:heading', 'cancel', 'export'],
      ['Changed heading', 'new.json'],
    );
    expect(await quoteDialogue(client, quoteFixture(), s.ui)).toBeUndefined();
    expect(exported[0]!.document.heading).toBe('Changed heading');
    expect(s.prompts).toContain('Unsaved changes (Ungespeicherte Änderungen)');
  });
  it('cancels initial customer search cleanly', async () => {
    const s = scripted([], ['^C']);
    expect(await quoteDialogue(client, undefined, s.ui)).toBeUndefined();
    expect(s.menus).toHaveLength(0);
  });
});
