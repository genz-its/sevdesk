import type { NumberSequence, SevDesk } from '@mi-skam/sevdesk-sdk';
import { describe, expect, it, vi } from 'vitest';
import {
  assertNumberAvailable,
  nextNumber,
  suggestNumber,
} from '../src/numbering';

const sequence = (overrides: Partial<NumberSequence> = {}): NumberSequence => ({
  id: '12',
  forObject: 'Order',
  type: 'AN',
  format: 'AN-%NUMBER',
  nextSequence: '2',
  ...overrides,
});
describe('automatic numbering (automatische Nummerierung)', () => {
  it('uses the highest matching numeric value, not string order or first/last row', () => {
    expect(
      suggestNumber('quote', sequence(), [
        'AN-9',
        'AN-2',
        'AN-10',
        'AB-999',
        'AN-old',
        null,
      ]),
    ).toMatchObject({
      nextNumber: 'AN-11',
      highestExistingNumber: 'AN-10',
      reserved: false,
    });
  });
  it('skips a configured counter already used by an existing draft', () => {
    expect(suggestNumber('quote', sequence(), ['AN-2']).nextNumber).toBe(
      'AN-3',
    );
  });
  it('respects a higher configured starting counter and empty series', () => {
    expect(
      suggestNumber('quote', sequence({ nextSequence: '50' }), ['AN-9'])
        .nextNumber,
    ).toBe('AN-50');
    expect(suggestNumber('quote', sequence(), []).nextNumber).toBe('AN-2');
  });
  it('handles literal regex characters, suffixes and leading-zero counters', () => {
    expect(
      suggestNumber(
        'quote',
        sequence({ format: 'A.(%NUMBER)/X', nextSequence: '0002' }),
        ['A.(0009)/X', 'Ax(9999)/X'],
      ).nextNumber,
    ).toBe('A.(0010)/X');
  });
  it('does not lose precision for large sequence values', () => {
    expect(
      suggestNumber('quote', sequence(), ['AN-9007199254740993']).nextNumber,
    ).toBe('AN-9007199254740994');
  });
  it.each([
    'AN-%YEAR-%NUMBER',
    'AN-%NUMBER-%NUMBER',
    'AN-number',
    'AN-%NUMBER%UNKNOWN',
  ])(
    'refuses unsupported format %s rather than inventing a number',
    (format) => {
      expect(() => suggestNumber('quote', sequence({ format }), [])).toThrow(
        'ausdrücklich eingeben',
      );
    },
  );
  it.each(['-1', '1.2', '', 'NaN'])(
    'rejects invalid configured counter %s',
    (nextSequence) => {
      expect(() =>
        suggestNumber('quote', sequence({ nextSequence }), []),
      ).toThrow();
    },
  );
  it('rejects a numbering series from the wrong type', () => {
    expect(() => suggestNumber('invoice', sequence(), [])).toThrow();
  });
  it('scans all pages without status/type filters, including drafts of other types', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce([
        { orderNumber: 'AN-9', status: '100', orderType: 'AN' },
      ])
      .mockResolvedValueOnce([
        { orderNumber: 'AN-10', status: '100', orderType: 'AB' },
      ])
      .mockResolvedValueOnce([]);
    const client = {
      basics: { getNumberSequence: vi.fn().mockResolvedValue(sequence()) },
      orders: { list },
    } as unknown as SevDesk;
    expect((await nextNumber(client, 'quote')).nextNumber).toBe('AN-11');
    expect(list).toHaveBeenCalledTimes(3);
    expect(list.mock.calls.map(([options]) => options.offset)).toEqual([
      0, 1, 2,
    ]);
    for (const [options] of list.mock.calls) {
      expect(options.status).toBeUndefined();
      expect(options.orderType).toBeUndefined();
    }
  });
  it('reads invoice numbering separately from quote numbering', async () => {
    const client = {
      basics: {
        getNumberSequence: vi.fn().mockResolvedValue(
          sequence({
            forObject: 'Invoice',
            type: 'RE',
            format: 'RE-%NUMBER',
          }),
        ),
      },
      invoices: {
        list: vi
          .fn()
          .mockResolvedValueOnce([{ invoiceNumber: 'RE-3' }])
          .mockResolvedValueOnce([]),
      },
    } as unknown as SevDesk;
    expect((await nextNumber(client, 'invoice')).nextNumber).toBe('RE-4');
    expect(client.basics.getNumberSequence).toHaveBeenCalledWith({
      objectType: 'Invoice',
      type: 'RE',
    });
  });
  it('does not silently use a stale configured counter after history lookup fails', async () => {
    const client = {
      basics: { getNumberSequence: vi.fn().mockResolvedValue(sequence()) },
      orders: { list: vi.fn().mockRejectedValue(new Error('offline')) },
    } as unknown as SevDesk;
    await expect(nextNumber(client, 'quote')).rejects.toThrow('offline');
  });
  it('guards duplicates even if the server ignores the number filter', async () => {
    const list = vi
      .fn()
      .mockResolvedValueOnce([{ orderNumber: 'AN-1' }, { orderNumber: 'AN-2' }])
      .mockResolvedValueOnce([]);
    await expect(
      assertNumberAvailable(
        { orders: { list } } as unknown as SevDesk,
        'quote',
        'AN-2',
      ),
    ).rejects.toThrow('bereits vergeben');
  });
});
