import type { NumberSequence, SevDesk } from '@mi-skam/sevdesk-sdk';
import { fetchAll } from './pagination';

export type NumberingKind = 'invoice' | 'quote';
export interface NumberSuggestion {
  kind: NumberingKind;
  format: string;
  configuredCounter: string;
  highestExistingNumber: string | null;
  nextNumber: string;
  reserved: false;
}
const fail = () =>
  new Error(
    'Automatic numbering is unavailable for this format; enter an explicit number (Automatische Nummerierung für dieses Format nicht verfügbar; Nummer ausdrücklich eingeben).',
  );
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** No guessing for unknown date/reset/format tokens; explicit numbers remain usable. */
export function suggestNumber(
  kind: NumberingKind,
  sequence: NumberSequence,
  existing: Iterable<string | null | undefined>,
): NumberSuggestion {
  if (
    !sequence ||
    sequence.forObject !== (kind === 'invoice' ? 'Invoice' : 'Order') ||
    sequence.type !== (kind === 'invoice' ? 'RE' : 'AN') ||
    typeof sequence.format !== 'string' ||
    typeof sequence.nextSequence !== 'string' ||
    !/^\d{1,256}$/.test(sequence.nextSequence)
  )
    throw fail();
  const parts = sequence.format.split('%NUMBER');
  if (parts.length !== 2 || parts.some((part) => part.includes('%')))
    throw fail();
  const pattern = new RegExp(
    `^${escape(parts[0]!)}(\\d+)${escape(parts[1]!)}$`,
  );
  let highest: bigint | undefined;
  let highestExistingNumber: string | null = null;
  for (const number of existing) {
    if (typeof number !== 'string') continue;
    const match = pattern.exec(number);
    if (!match) continue;
    if (match[1]!.length > 256) throw fail();
    const value = BigInt(match[1]!);
    if (highest === undefined || value > highest) {
      highest = value;
      highestExistingNumber = number;
    }
  }
  const configured = BigInt(sequence.nextSequence);
  const next =
    highest !== undefined && highest >= configured ? highest + 1n : configured;
  const width = sequence.nextSequence.startsWith('0')
    ? sequence.nextSequence.length
    : 0;
  return {
    kind,
    format: sequence.format,
    configuredCounter: sequence.nextSequence,
    highestExistingNumber,
    nextNumber: parts[0]! + next.toString().padStart(width, '0') + parts[1]!,
    reserved: false,
  };
}

/** Reads the configured series and all existing numbers, including drafts. Never reserves or writes. */
export async function nextNumber(
  client: SevDesk,
  kind: NumberingKind,
): Promise<NumberSuggestion> {
  const sequence = await client.basics.getNumberSequence(
    kind === 'invoice'
      ? { objectType: 'Invoice', type: 'RE' }
      : { objectType: 'Order', type: 'AN' },
  );
  suggestNumber(kind, sequence, []); // Validate configuration before traversing history.
  // Do not restrict status/type: another draft/type using this printed number also occupies it.
  const numbers =
    kind === 'invoice'
      ? (
          await fetchAll((page) =>
            client.invoices.list({ ...page, showAll: true }),
          )
        ).map((invoice) => invoice.invoiceNumber)
      : (await fetchAll((page) => client.orders.list(page))).map(
          (order) => order.orderNumber,
        );
  return suggestNumber(kind, sequence, numbers);
}

/** Best-effort duplicate guard, not an atomic reservation. Never retries a write. */
export async function assertNumberAvailable(
  client: SevDesk,
  kind: NumberingKind,
  number: string,
): Promise<void> {
  const found =
    kind === 'invoice'
      ? (
          await fetchAll((page) =>
            client.invoices.list({
              invoiceNumber: number,
              ...page,
              showAll: true,
            }),
          )
        ).some((invoice) => invoice.invoiceNumber === number)
      : (
          await fetchAll((page) =>
            client.orders.list({ orderNumber: number, ...page }),
          )
        ).some((order) => order.orderNumber === number);
  if (found)
    throw new Error(
      `${kind === 'invoice' ? 'Invoice number (Rechnungsnummer)' : 'Quote number (Angebotsnummer)'} already exists; refresh the suggestion or choose another number (bereits vergeben; Vorschlag aktualisieren oder andere Nummer wählen).`,
    );
}
