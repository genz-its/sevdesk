import type { Contact, SevDesk } from '@mi-skam/sevdesk-sdk';
import { consola } from 'consola';
import { Decimal } from 'decimal.js';
import { z } from 'zod';
import { assertNumberAvailable, nextNumber } from '../numbering';
import { contactLabel } from '../output';
import { fetchAll } from '../pagination';
import { newQuote } from './defaults';
import {
  fieldLabel,
  fieldSchema,
  fieldValue,
  oneLine,
  positionLabel,
  quoteFields,
  quoteFieldValue,
  type Field,
  type QuoteField,
} from './editor';
import {
  compactLabel,
  layoutChoices,
  layoutMessage,
  terminalColors,
} from './layout';
import {
  deliverySchema,
  positionSchema,
  preview,
  quoteAutoNumberSchema,
  quoteDraftSchema,
  quoteReadySchema,
  totals,
  type Position,
  type QuoteDraft,
} from './model';
import { quoteError } from './presentation';
import {
  addresses,
  addressText,
  customers,
  exportQuote,
  resolveQuote,
} from './service';

export interface Choice {
  value: string;
  label: string;
  caption?: string;
  preview?: string;
  group?: string;
  depth?: number;
  missing?: boolean;
  tone?: 'primary' | 'danger' | 'position';
}
export interface QuoteUI {
  choose(message: string, choices: Choice[], initial?: string): Promise<string>;
  text(message: string, initial?: string): Promise<string>;
  confirm(message: string): Promise<boolean>;
  show(message: string): void;
}
class Cancelled extends Error {}
export const terminalUI: QuoteUI = {
  async choose(message, options, initial) {
    if (!options.length)
      throw new Error('No available options (Keine verfügbaren Optionen).');
    const color = terminalColors();
    const value = await consola.prompt(layoutMessage(message, color), {
      type: 'select',
      options: layoutChoices(options, {
        columns: process.stdout.columns ?? 100,
        rows: process.stdout.rows ?? 24,
        color,
      }),
      initial,
      cancel: 'symbol',
    });
    if (
      typeof value !== 'string' ||
      !options.some((option) => option.value === value)
    )
      throw new Cancelled();
    return value;
  },
  async text(message, initial) {
    const value = await consola.prompt(message, {
      type: 'text',
      initial,
      default: '',
      placeholder: '',
      cancel: 'symbol',
    });
    if (typeof value === 'symbol') throw new Cancelled();
    return typeof value === 'string' ? value : '';
  },
  async confirm(message) {
    const value = await consola.prompt(message, {
      type: 'confirm',
      initial: false,
      cancel: 'symbol',
    });
    return value === true;
  },
  show(message) {
    consola.info(message);
  },
};
const c = (
  value: string,
  label: string,
  presentation: Omit<Choice, 'value' | 'label'> = {},
): Choice => ({ value, label, ...presentation });

/** Each accepted field edit changes only the local draft. Esc cancels this field. */
async function readField(
  ui: QuoteUI,
  field: Field,
  initial: unknown,
  schema: z.ZodType,
): Promise<unknown> {
  let value = initial;
  while (true) {
    if (field.kind === 'boolean')
      value =
        (await ui.choose(
          field.label,
          [c('true', 'Yes (Ja)'), c('false', 'No (Nein)')],
          value === true ? 'true' : 'false',
        )) === 'true';
    else if (field.kind === 'mode')
      value = await ui.choose(
        field.label,
        [c('net', 'Net (Netto)'), c('gross', 'Gross (Brutto)')],
        typeof value === 'string' ? value : undefined,
      );
    else {
      const input = await ui.text(
        field.label +
          (field.kind === 'multiline'
            ? ' — use \\n for line breaks (\\n für Zeilenumbrüche)'
            : '') +
          (field.optional ? ' — empty clears (leer entfernt)' : ''),
        value === undefined
          ? ''
          : field.kind === 'array'
            ? (value as string[]).join(', ')
            : field.kind === 'multiline'
              ? String(value).replaceAll('\n', '\\n')
              : String(value),
      );
      value =
        input === '' && field.optional
          ? undefined
          : field.kind === 'number'
            ? Number(input)
            : field.kind === 'array'
              ? input
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean)
              : field.kind === 'multiline'
                ? input.replaceAll('\\n', '\n')
                : input;
    }
    const parsed = schema.safeParse(value);
    if (parsed.success) return parsed.data;
    ui.show(quoteError(parsed.error, { '': field.label }));
  }
}

/** Existing records commit each valid edit locally; new records remain staged until complete. */
async function form<S extends z.ZodObject>(
  ui: QuoteUI,
  title: string,
  initial: unknown,
  schema: S,
  fields: Field[],
  options: {
    onChange?: (value: z.infer<S>) => void;
    finish?: string;
    actions?: Choice[];
    onAction?: (action: string) => void;
  } = {},
): Promise<z.infer<S> | undefined> {
  const values = structuredClone(initial ?? {}) as Record<string, unknown>;
  const original = JSON.stringify(values);
  let cursor = fields[0]?.key;
  while (true) {
    try {
      const checked = schema.safeParse(values);
      const missing = new Set(
        checked.success
          ? []
          : checked.error.issues.map((issue) => String(issue.path[0])),
      );
      const selected = await ui.choose(
        title,
        [
          ...fields.map((field) =>
            c(
              field.key,
              fieldLabel(field, values[field.key], missing.has(field.key)),
              {
                caption: compactLabel(field.key, field.label),
                preview: fieldValue(field, values[field.key]),
                missing: missing.has(field.key),
                depth: 1,
              },
            ),
          ),
          ...(options.actions ?? []).map((action) => ({
            ...action,
            group: 'Position actions (Positionsaktionen)',
            depth: 1,
          })),
          c('done', options.finish ?? 'Back to quote (Zurück zum Angebot)', {
            caption: options.finish ?? '← Back to quote (Zurück zum Angebot)',
            depth: 0,
            tone: 'primary',
          }),
        ],
        cursor,
      );
      cursor = selected;
      if (selected === 'done') {
        if (checked.success) return checked.data as z.infer<S>;
        ui.show(
          quoteError(
            checked.error,
            Object.fromEntries(fields.map((field) => [field.key, field.label])),
          ),
        );
        cursor = String(checked.error.issues[0]?.path[0] ?? fields[0]?.key);
        continue;
      }
      if (options.actions?.some((action) => action.value === selected)) {
        options.onAction?.(selected);
        return;
      }
      const field = fields.find((field) => field.key === selected)!;
      try {
        const value = await readField(
          ui,
          field,
          values[field.key],
          (schema.shape as Record<string, z.ZodType>)[field.key]!,
        );
        if (value === undefined) delete values[field.key];
        else values[field.key] = value;
        const updated = schema.safeParse(values);
        if (updated.success) options.onChange?.(updated.data as z.infer<S>);
      } catch (error) {
        if (!(error instanceof Cancelled)) throw error;
        // Cancelling one input leaves earlier accepted edits intact.
      }
    } catch (error) {
      if (!(error instanceof Cancelled)) throw error;
      if (options.onChange && schema.safeParse(values).success) return;
      if (
        JSON.stringify(values) === original ||
        (await ui.confirm(
          'Discard unfinished entry? (Unvollständigen Eintrag verwerfen?)',
        ))
      )
        return;
    }
  }
}

function summary(q: QuoteDraft, selectedCustomerName?: string): string {
  const t = totals(q);
  const customer = q.customer
    ? 'number' in q.customer
      ? `#${q.customer.number}`
      : 'Selected customer (Ausgewählter Kunde)'
    : 'No customer (Kein Kunde)';
  return [
    `Quote draft (Angebotsentwurf) · ${selectedCustomerName ?? customer}`,
    `Date (Angebotsdatum): ${q.document.date ?? '—'} · Valid until (Gültig bis): ${q.document.validUntil ?? '—'}`,
    `Heading (Betreff): ${q.document.heading ?? '—'} · ${q.document.currency ?? '—'} · ${q.document.priceMode ?? 'price mode missing (Preisart fehlt)'}`,
    ...q.positions.map(
      (p, i) =>
        `${i + 1}. ${p.name} | ${p.quantity} ${p.unit.label ?? `unit ${p.unit.id}`} × ${p.unitPrice} | VAT ${p.vatRate}% | discount ${p.discount ?? '0'}%${p.optional ? ' [optional (optional)]' : ''}\n   ${p.description ?? ''}`,
    ),
    `Net (Netto): ${t.net} · VAT (Umsatzsteuer): ${t.vat} · Total (Gesamtbetrag): ${t.gross}`,
    'Indicative totals (Voraussichtliche Summen); optional positions excluded (ohne optionale Positionen).',
    `Introduction (Einleitung): ${q.texts.introduction ?? '—'}`,
    `Closing (Schlusstext): ${q.texts.closing ?? '—'}`,
    `Payment terms (Zahlungsbedingungen): ${q.terms.payment ?? '—'}`,
    `Delivery terms (Lieferbedingungen): ${q.terms.delivery ?? '—'}`,
    `Address (Empfängeradresse): ${q.recipient?.address ?? 'Use customer address after validation (Kundenadresse nach Prüfung)'}`,
  ].join('\n');
}

export interface DialogueResult {
  quote: QuoteDraft;
  send: boolean;
}
export async function quoteDialogue(
  client: () => Promise<SevDesk>,
  loaded?: QuoteDraft,
  ui: QuoteUI = terminalUI,
): Promise<DialogueResult | undefined> {
  const q = structuredClone(loaded ?? newQuote());
  let cachedCustomers: Contact[] | undefined;
  let selectedCustomerName: string | undefined;
  let showInactive = false;
  let removed: { position: Position; index: number } | undefined;
  let selectedPosition = 0;
  let baseline = JSON.stringify(quoteDraftSchema.parse(q));
  let generatedHeading: string | undefined = loaded ? undefined : 'Angebot';

  async function suggestQuoteNumber() {
    const suggestion = await nextNumber(await client(), 'quote');
    const mayUpdateHeading =
      q.document.heading === undefined ||
      q.document.heading === generatedHeading;
    q.document.number = suggestion.nextNumber;
    if (mayUpdateHeading)
      q.document.heading =
        generatedHeading = `Angebot Nr. ${suggestion.nextNumber}`;
    ui.show(
      `Suggested quote number (Vorgeschlagene Angebotsnummer): ${suggestion.nextNumber}; not reserved (nicht reserviert).`,
    );
  }

  function selectCustomerIdentity(contact?: Contact) {
    const same = contact
      ? q.customer &&
        ('id' in q.customer
          ? q.customer.id === Number(contact.id)
          : q.customer.number === contact.customerNumber)
      : q.customer === null;
    selectedCustomerName = contact ? contactLabel(contact) : undefined;
    if (same) return;
    q.customer = contact ? { id: Number(contact.id) } : null;
    delete q.recipient;
    if (q.delivery.to || q.delivery.cc?.length || q.delivery.bcc?.length)
      ui.show(
        'Customer changed: email recipients cleared (Kunde geändert: E-Mail-Empfänger zurückgesetzt).',
      );
    delete q.delivery.to;
    delete q.delivery.cc;
    delete q.delivery.bcc;
  }

  async function selectCustomer(firstScreen = false) {
    try {
      let query: string | undefined;
      while (true) {
        if (!cachedCustomers) {
          try {
            cachedCustomers = await customers(await client());
          } catch (e) {
            ui.show(
              'Customer loading failed (Kunden konnten nicht geladen werden): ' +
                quoteError(e),
            );
            const next = await ui.choose('Customer (Kunde)', [
              c('retry', 'Retry (Erneut versuchen)'),
              c('empty', 'No customer yet (Kein Kunde)'),
              c('back', firstScreen ? 'Cancel (Abbrechen)' : 'Back (Zurück)'),
            ]);
            if (next === 'back' && firstScreen) throw new Cancelled();
            if (next === 'retry') continue;
            if (next === 'empty') selectCustomerIdentity();
            return;
          }
        }
        if (query === undefined)
          query = (
            await ui.text(
              'Search customer name or number (Kundenname oder Kundennummer suchen); empty shows all',
            )
          )
            .trim()
            .toLocaleLowerCase();
        const search = query;
        const rows = cachedCustomers.filter(
          (v) =>
            (showInactive || v.status === '1000') &&
            `${v.customerNumber ?? ''} ${contactLabel(v)}`
              .toLocaleLowerCase()
              .includes(search),
        );
        if (!rows.length)
          ui.show('No matching customers (Keine passenden Kunden).');
        rows.sort((a, b) => {
          const score = (v: Contact) =>
            v.customerNumber?.toLowerCase() === search
              ? 0
              : contactLabel(v).toLowerCase().startsWith(search)
                ? 1
                : 2;
          return (
            score(a) - score(b) ||
            contactLabel(a).localeCompare(contactLabel(b))
          );
        });
        const grouped: Contact[] = [];
        for (const row of rows.filter(
          (v) => !v.parent || !rows.some((p) => p.id === v.parent?.id),
        )) {
          grouped.push(row, ...rows.filter((v) => v.parent?.id === row.id));
        }
        const selected = await ui.choose(
          'Customer (Kunde)',
          [
            c('empty', '— No customer yet (Kein Kunde) —'),
            ...grouped.map((v) =>
              c(
                v.id,
                `${v.parent ? '  ↳ ' : ''}${v.customerNumber ?? '—'} · ${contactLabel(v)}${v.status !== '1000' ? ' [not active (nicht aktiv)]' : ''}`,
              ),
            ),
            c('search', 'Search again (Erneut suchen)'),
            c('refresh', 'Refresh (Aktualisieren)'),
            c(
              'inactive',
              showInactive
                ? 'Hide inactive (Inaktive ausblenden)'
                : 'Show inactive (Inaktive anzeigen)',
            ),
            c('back', firstScreen ? 'Cancel (Abbrechen)' : 'Back (Zurück)'),
          ],
          grouped.find(
            (contact) =>
              q.customer &&
              ('id' in q.customer
                ? q.customer.id === Number(contact.id)
                : q.customer.number === contact.customerNumber &&
                  !contact.parent),
          )?.id ?? 'empty',
        );
        if (selected === 'back') {
          if (firstScreen) throw new Cancelled();
          return;
        }
        if (selected === 'search') {
          query = undefined;
          continue;
        }
        if (selected === 'refresh') {
          cachedCustomers = undefined;
          continue;
        }
        if (selected === 'inactive') {
          showInactive = !showInactive;
          continue;
        }
        if (selected === 'empty') {
          selectCustomerIdentity();
          return;
        }
        const contact = cachedCustomers.find((v) => v.id === selected);
        if (!contact)
          throw new Error(
            'Selected customer is no longer available (Kunde nicht mehr verfügbar).',
          );
        selectCustomerIdentity(contact);
        try {
          const choices = await addresses(await client(), Number(selected));
          const chosen = await ui.choose(
            'Recipient address (Empfängeradresse)',
            [
              ...choices.map((a) =>
                c(
                  a.id,
                  [a.street, a.zip, a.city].filter(Boolean).join(', ') ||
                    'Incomplete address (Unvollständige Adresse)',
                ),
              ),
              c(
                'custom',
                'Quote recipient address (Empfängeradresse für dieses Angebot)',
              ),
              c(
                'later',
                q.recipient
                  ? 'Keep current address (Aktuelle Adresse behalten)'
                  : 'Choose later (Später auswählen)',
              ),
            ],
            q.recipient ? 'later' : undefined,
          );
          if (chosen === 'custom') await editRecipient();
          else if (chosen !== 'later') {
            const address = choices.find((a) => a.id === chosen)!;
            if (!address.street || !address.zip || !address.city)
              ui.show(
                'Incomplete address (Unvollständige Adresse); complete it before saving.',
              );
            else
              q.recipient = {
                address: addressText(contact, address),
                countryId: Number(address.country.id),
              };
          }
        } catch (e) {
          if (e instanceof Cancelled) throw e;
          ui.show(quoteError(e));
        }
        return;
      }
    } catch (error) {
      if (!(error instanceof Cancelled) || firstScreen) throw error;
    }
  }
  async function editRecipient() {
    const result = await form(
      ui,
      'Quote recipient address (Empfängeradresse für dieses Angebot)',
      q.recipient,
      quoteDraftSchema.shape.recipient.unwrap(),
      [
        {
          key: 'address',
          label: 'Complete address (Vollständige Adresse)',
          kind: 'multiline',
        },
        { key: 'countryId', label: 'Country ID (Länder-ID)', kind: 'number' },
      ],
      {
        onChange: (value) => {
          q.recipient = value as NonNullable<QuoteDraft['recipient']>;
        },
      },
    );
    if (result) {
      q.recipient = {
        ...result,
        address: result.address.replaceAll('\\n', '\n'),
      };
    }
  }
  async function editQuoteField(field: QuoteField) {
    try {
      const value = await readField(
        ui,
        field,
        quoteFieldValue(q, field),
        fieldSchema(field),
      );
      const section = q[field.section] as Record<string, unknown>;
      if (
        field.section === 'document' &&
        field.key === 'priceMode' &&
        q.positions.length &&
        q.document.priceMode &&
        value !== q.document.priceMode
      ) {
        const action = await ui.choose(
          'Changing net/gross pricing (Netto-/Bruttopreise ändern)',
          [
            c(
              'convert',
              'Convert unit prices to preserve amounts (Einzelpreise umrechnen)',
            ),
            c(
              'reinterpret',
              'Keep numbers and reinterpret prices (Beträge neu interpretieren)',
            ),
            c(
              'cancel',
              'Keep existing pricing mode (Bisherige Preisart behalten)',
            ),
          ],
          'cancel',
        );
        if (action === 'cancel') return;
        if (action === 'convert') {
          const converted = q.positions.map((position) => {
            const factor = new Decimal(position.vatRate).div(100).plus(1);
            const price = new Decimal(position.unitPrice);
            const unitPrice = (
              value === 'gross' ? price.mul(factor) : price.div(factor)
            ).toFixed(4);
            return positionSchema.parse({ ...position, unitPrice });
          });
          q.positions = converted;
        }
      }
      if (
        field.section === 'document' &&
        field.key === 'number' &&
        generatedHeading &&
        q.document.heading === generatedHeading
      )
        q.document.heading = generatedHeading = value
          ? 'Angebot Nr. ' + value
          : 'Angebot';
      if (value === undefined) delete section[field.key];
      else section[field.key] = value;
    } catch (error) {
      if (!(error instanceof Cancelled)) throw error;
    }
  }
  async function editPosition(index?: number) {
    try {
      const previous = index === undefined ? undefined : q.positions[index];
      let pendingPriceMode = q.document.priceMode;
      let initial: Record<string, unknown> = previous
        ? {
            ...previous,
            unitId: previous.unit.id,
            unitLabel: previous.unit.label,
          }
        : { quantity: '1', unitPrice: '0' };
      if (!previous) {
        const name = await ui.text(
          'Name or catalogue search (Bezeichnung oder Artikelsuche)',
        );
        initial.name = name;
        if (name.trim()) {
          const mode = await ui.choose('Position (Position)', [
            c('custom', `Use custom name: ${name} (Eigene Position)`),
            c('catalogue', 'Search catalogue (Artikelstamm durchsuchen)'),
          ]);
          if (mode === 'catalogue') {
            if (!pendingPriceMode) {
              pendingPriceMode = (await ui.choose(
                'Choose price mode before copying catalogue prices (Preisart vor Artikelübernahme wählen)',
                [c('net', 'Net (Netto)'), c('gross', 'Gross (Brutto)')],
              )) as 'net' | 'gross';
            }
            try {
              const parts = await fetchAll((page) =>
                client().then((api) => api.parts.list({ name, ...page })),
              );
              const choice = await ui.choose('Product/service (Artikel)', [
                ...parts.map((p) =>
                  c(p.id, `${p.partNumber ?? '—'} · ${p.name}`),
                ),
                c('custom', 'Use custom position (Eigene Position)'),
              ]);
              const part = parts.find((p) => p.id === choice);
              if (part)
                initial = {
                  name: part.name ?? name,
                  description: part.text ?? undefined,
                  unitId: part.unity ? Number(part.unity.id) : undefined,
                  unitPrice:
                    pendingPriceMode === 'gross'
                      ? (part.priceGross ?? undefined)
                      : (part.priceNet ?? undefined),
                  vatRate: part.taxRate,
                  quantity: '1',
                };
            } catch (e) {
              if (e instanceof Cancelled) throw e;
              ui.show(quoteError(e));
            }
          }
        }
      }
      delete initial.unit;
      const flatSchema = positionSchema.omit({ unit: true }).extend({
        unitId: z.number().int().positive(),
        unitLabel: z.string().optional(),
      });
      const commit = (position: z.infer<typeof flatSchema>) => {
        const { unitId, unitLabel, ...rest } = position;
        const value = positionSchema.parse({
          ...rest,
          unit: { id: unitId, ...(unitLabel ? { label: unitLabel } : {}) },
        });
        if (pendingPriceMode) q.document.priceMode = pendingPriceMode;
        if (index === undefined) {
          q.positions.push(value);
          selectedPosition = q.positions.length - 1;
        } else q.positions[index] = value;
      };
      const position = await form(
        ui,
        index === undefined
          ? 'Add position (Position hinzufügen)'
          : 'Position ' + (index + 1) + ' · ' + oneLine(previous!.name, 50),
        initial,
        flatSchema,
        [
          { key: 'name', label: 'Name (Bezeichnung)' },
          {
            key: 'description',
            label: 'Description (Beschreibung)',
            kind: 'multiline',
            optional: true,
          },
          { key: 'quantity', label: 'Quantity, decimal (Menge)' },
          { key: 'unitId', label: 'Unit ID (Einheiten-ID)', kind: 'number' },
          { key: 'unitLabel', label: 'Unit label (Einheit)', optional: true },
          { key: 'unitPrice', label: 'Unit price (Einzelpreis)' },
          { key: 'vatRate', label: 'VAT rate % (Umsatzsteuersatz)' },
          { key: 'discount', label: 'Discount % (Rabatt)', optional: true },
          {
            key: 'optional',
            label: 'Optional position (Optionale Position)',
            kind: 'boolean',
          },
        ],
        index === undefined
          ? {
              finish: 'Add position to quote (Position zum Angebot hinzufügen)',
            }
          : {
              onChange: commit,
              actions: [
                c('duplicate', 'Duplicate position (Position duplizieren)'),
                c('remove', 'Remove position (Position entfernen)'),
                ...(index > 0 ? [c('up', 'Move up (Nach oben)')] : []),
                ...(index < q.positions.length - 1
                  ? [c('down', 'Move down (Nach unten)')]
                  : []),
              ],
              onAction(action) {
                if (action === 'duplicate') {
                  q.positions.splice(
                    index + 1,
                    0,
                    structuredClone(q.positions[index]!),
                  );
                  selectedPosition = index + 1;
                } else if (action === 'remove') {
                  removed = {
                    position: q.positions.splice(index, 1)[0]!,
                    index,
                  };
                  selectedPosition = Math.max(
                    0,
                    Math.min(index, q.positions.length - 1),
                  );
                } else if (action === 'up' || action === 'down') {
                  const target = index + (action === 'up' ? -1 : 1);
                  [q.positions[index], q.positions[target]] = [
                    q.positions[target]!,
                    q.positions[index]!,
                  ];
                  selectedPosition = target;
                }
              },
            },
      );
      if (position && index === undefined) commit(position);
    } catch (error) {
      if (!(error instanceof Cancelled)) throw error;
    }
  }
  async function editDelivery() {
    try {
      let email: string | undefined;
      if (!q.delivery.to && q.customer) {
        try {
          const api = await client();
          const contact =
            'id' in q.customer
              ? await api.contacts.get({ contactId: q.customer.id })
              : (await customers(api)).find(
                  (v) =>
                    v.customerNumber ===
                      (q.customer && 'number' in q.customer
                        ? q.customer.number
                        : '') && !v.parent,
                );
          if (contact) {
            const ways = await fetchAll((page) =>
              api.communicationWays.list({
                contactId: Number(contact.id),
                ...page,
              }),
            );
            const emails = [
              ...new Set(
                ways
                  .filter(
                    (v) =>
                      v.type === 'EMAIL' &&
                      (!v.contact || v.contact.id === contact.id),
                  )
                  .map((v) =>
                    typeof v.value === 'string' ? v.value.trim() : '',
                  )
                  .filter(
                    (value) => deliverySchema.shape.to.safeParse(value).success,
                  ),
              ),
            ];
            if (emails.length) {
              const selected = await ui.choose('Recipient (Empfänger)', [
                ...emails.map((v) => c(v, v)),
                c('manual', 'Enter another address (Andere Adresse eingeben)'),
              ]);
              if (selected !== 'manual') email = selected;
            }
          }
        } catch (e) {
          if (e instanceof Cancelled) throw e;
          ui.show(quoteError(e));
        }
      }
      const initial = {
        subject: 'Angebot {{number}}',
        message:
          'Guten Tag,\n\nanbei erhalten Sie unser Angebot.\n\nMit freundlichen Grüßen',
        ...q.delivery,
        ...(email ? { to: email } : {}),
      };
      const result = await form(
        ui,
        'Send quote (Angebot versenden)',
        initial,
        deliverySchema,
        [
          { key: 'to', label: 'Recipient (Empfänger)' },
          {
            key: 'cc',
            label: 'CC, comma separated (Kopie)',
            kind: 'array',
            optional: true,
          },
          {
            key: 'bcc',
            label: 'BCC, comma separated (Blindkopie)',
            kind: 'array',
            optional: true,
          },
          {
            key: 'subject',
            label: 'Subject; {{number}} is replaced (Betreff)',
          },
          { key: 'message', label: 'Message (Nachricht)', kind: 'multiline' },
          {
            key: 'copyToSelf',
            label: 'Copy to self (Kopie an mich)',
            kind: 'boolean',
          },
        ],
        {
          finish: 'Review email (E-Mail prüfen)',
          onChange: (value) => {
            q.delivery = value;
          },
        },
      );
      if (!result) return false;
      q.delivery = result;
      const number = q.document.number!;
      ui.show(
        `To (Empfänger): ${result.to}\nCC: ${result.cc?.join(', ') || '—'}\nBCC: ${result.bcc?.join(', ') || '—'}\nSubject (Betreff): ${result.subject.replaceAll('{{number}}', number)}\nMessage (Nachricht): ${result.message.replaceAll('{{number}}', number)}\nAttachment (Anhang): Quote PDF (Angebots-PDF)\nCopy to self (Kopie an mich): ${result.copyToSelf ?? false}`,
      );
      return ui.confirm('Save and send now? (Jetzt speichern und versenden?)');
    } catch (error) {
      if (!(error instanceof Cancelled)) throw error;
      return false;
    }
  }
  async function exportLocal() {
    try {
      const path = await ui.text(
        'New export path; never overwrites (Neuer Exportpfad; kein Überschreiben)',
        'quote.json',
      );
      await exportQuote(path, q);
      ui.show(`Exported (Exportiert): ${path}`);
      baseline = JSON.stringify(quoteDraftSchema.parse(q));
      return true;
    } catch (error) {
      if (!(error instanceof Cancelled)) throw error;
      return false;
    }
  }
  async function leave() {
    if (JSON.stringify(quoteDraftSchema.parse(q)) === baseline) return true;
    const action = await ui.choose(
      'Unsaved changes (Ungespeicherte Änderungen)',
      [
        c('back', 'Back (Zurück)'),
        c('export', 'Export and exit (Exportieren und beenden)'),
        c('discard', 'Discard and exit (Verwerfen und beenden)'),
      ],
    );
    if (action === 'export') return exportLocal();
    return action === 'discard';
  }

  // New quotes start with customer selection; imported quotes open in the editor.
  if (!loaded) {
    try {
      await suggestQuoteNumber();
    } catch (error) {
      ui.show(
        'Could not prefill quote number (Angebotsnummer konnte nicht vorbelegt werden): ' +
          quoteError(error),
      );
    }
    q.document.heading ??= 'Angebot';
    baseline = JSON.stringify(quoteDraftSchema.parse(q));
    try {
      await selectCustomer(true);
    } catch (error) {
      if (!(error instanceof Cancelled)) throw error;
      if (await leave()) return;
    }
  } else if (q.customer) {
    try {
      cachedCustomers = await customers(await client());
      const selected = q.customer;
      const contact = cachedCustomers.find((item) =>
        'id' in selected
          ? Number(item.id) === selected.id
          : item.customerNumber === selected.number && !item.parent,
      );
      if (contact) selectedCustomerName = contactLabel(contact);
    } catch {
      // The local draft remains editable when optional name lookup is unavailable.
    }
  }
  let cursor = q.positions.length ? 'position:0' : 'add';
  while (true) {
    try {
      const readiness = quoteAutoNumberSchema.safeParse(q);
      const missing = new Set(
        readiness.success
          ? []
          : readiness.error.issues.map((issue) => issue.path.join(':')),
      );
      const fieldRows = (fields: QuoteField[]) =>
        fields.map((field) => {
          const key = field.section + ':' + field.key;
          const value = quoteFieldValue(q, field);
          return c(
            key,
            field.section === 'document' && field.key === 'number' && !value
              ? field.label + '  Automatic on save (Automatisch beim Speichern)'
              : fieldLabel(field, value, missing.has(key)),
            {
              caption: compactLabel(field.key, field.label),
              preview:
                field.section === 'document' && field.key === 'number' && !value
                  ? 'Automatic (Automatisch)'
                  : fieldValue(field, value),
              missing: missing.has(key),
              group:
                field.section === 'texts'
                  ? 'Texts (Texte)'
                  : field.section === 'terms'
                    ? 'Terms (Bedingungen)'
                    : field.section === 'document' &&
                        [
                          'number',
                          'date',
                          'validUntil',
                          'heading',
                          'currency',
                          'priceMode',
                        ].includes(field.key)
                      ? 'Quote (Angebot)'
                      : 'Settings (Einstellungen)',
            },
          );
        });
      const customer =
        selectedCustomerName ??
        (q.customer
          ? 'number' in q.customer
            ? '#' + q.customer.number
            : 'Customer ID ' + q.customer.id
          : 'No customer (Kein Kunde)');
      const t = totals(q);
      const action = await ui.choose(
        'Quote editor (Angebot bearbeiten) · local draft (lokaler Entwurf)\n' +
          'Net (Netto): ' +
          t.net +
          ' · VAT (Umsatzsteuer): ' +
          t.vat +
          ' · Total (Gesamtbetrag): ' +
          t.gross +
          ' ' +
          (q.document.currency ?? '') +
          '\n↑/↓ select · Enter edit · Esc exit (Auswählen · Bearbeiten · Beenden) · Preview (Vorschau)',
        [
          c(
            'customer',
            (missing.has('customer') ? '⚠ ' : '') +
              'Customer (Kunde)  ' +
              oneLine(customer),
            {
              caption: 'Customer (Kunde)',
              preview: customer,
              group: 'Recipient (Empfänger)',
              depth: 0,
              missing: missing.has('customer'),
              tone: 'position',
            },
          ),
          c(
            'recipient',
            'Recipient address (Empfängeradresse)  ' +
              oneLine(
                q.recipient?.address ?? 'Customer address (Kundenadresse)',
              ),
            {
              caption: 'Address (Adresse)',
              preview:
                q.recipient?.address ?? 'Customer address (Kundenadresse)',
              group: 'Recipient (Empfänger)',
            },
          ),
          ...fieldRows(
            quoteFields.filter(
              (field) =>
                field.section === 'document' &&
                [
                  'number',
                  'date',
                  'validUntil',
                  'heading',
                  'currency',
                  'priceMode',
                ].includes(field.key),
            ),
          ),
          ...q.positions.map((position, index) =>
            c('position:' + index, positionLabel(q, index), {
              caption: index + 1 + '. ' + position.name,
              preview:
                position.quantity +
                ' ' +
                (position.unit.label ?? 'unit #' + position.unit.id) +
                ' × ' +
                position.unitPrice +
                ' ' +
                (q.document.currency ?? '') +
                ' · ' +
                position.vatRate +
                '% USt' +
                (position.discount && Number(position.discount)
                  ? ' · −' + position.discount + '%'
                  : '') +
                (position.optional ? ' · optional' : ''),
              group: 'Positions (Positionen)',
              tone: 'position',
            }),
          ),
          c(
            'add',
            (missing.has('positions') ? '⚠ ' : '') +
              '+ Add position (Position hinzufügen)',
            {
              caption: '+ Add position (Position hinzufügen)',
              group: 'Positions (Positionen)',
              missing: missing.has('positions'),
            },
          ),
          ...(removed
            ? [
                c(
                  'undo',
                  'Restore removed position (Entfernte Position wiederherstellen)  ' +
                    oneLine(removed.position.name),
                  { group: 'Positions (Positionen)' },
                ),
              ]
            : []),
          ...fieldRows(
            quoteFields.filter(
              (field) =>
                field.section !== 'document' ||
                ![
                  'number',
                  'date',
                  'validUntil',
                  'heading',
                  'currency',
                  'priceMode',
                ].includes(field.key),
            ),
          ),
          c(
            'number',
            'Refresh suggested quote number (Nächste Angebotsnummer vorschlagen)',
            {
              caption: '↻ Next number (Nächste Nummer)',
              group: 'Settings (Einstellungen)',
            },
          ),
          c('export', 'Export JSON (JSON exportieren)', {
            caption: 'Export JSON (JSON exportieren)',
            group: 'Actions (Aktionen)',
            depth: 0,
          }),
          c(
            'save',
            'Save draft in sevdesk (Entwurf in sevdesk speichern)' +
              (readiness.success ? '' : ' · incomplete (unvollständig)'),
            {
              caption:
                'Save in sevdesk (Entwurf speichern)' +
                (readiness.success ? '' : ' · incomplete (unvollständig)'),
              group: 'Actions (Aktionen)',
              depth: 0,
              tone: 'primary',
            },
          ),
          ...(readiness.success
            ? [
                c('send', 'Save and send (Speichern und versenden)', {
                  caption: 'Save & send (Speichern & versenden)',
                  group: 'Actions (Aktionen)',
                  depth: 0,
                  tone: 'primary',
                }),
              ]
            : []),
          c('cancel', 'Exit (Beenden)', {
            group: 'Actions (Aktionen)',
            depth: 0,
            tone: 'danger',
          }),
        ],
        cursor,
      );
      cursor = action;
      const field = quoteFields.find(
        (field) => field.section + ':' + field.key === action,
      );
      if (field) await editQuoteField(field);
      else if (action === 'cancel') {
        if (await leave()) return;
      } else if (action === 'customer') await selectCustomer();
      else if (action === 'recipient') await editRecipient();
      else if (action === 'export') await exportLocal();
      else if (action === 'number') await suggestQuoteNumber();
      else if (action === 'add') {
        const count = q.positions.length;
        await editPosition();
        if (q.positions.length > count) cursor = 'position:' + selectedPosition;
      } else if (action === 'undo') {
        selectedPosition = Math.min(removed!.index, q.positions.length);
        q.positions.splice(selectedPosition, 0, removed!.position);
        removed = undefined;
        cursor = 'position:' + selectedPosition;
      } else if (action === 'save' || action === 'send') {
        if (!readiness.success) {
          ui.show(
            'Not ready to save (Noch nicht speicherbereit):\n' +
              quoteError(readiness.error),
          );
          const path = readiness.error.issues[0]?.path.join(':');
          cursor =
            path === 'customer'
              ? 'customer'
              : path?.startsWith('positions')
                ? 'add'
                : (path ?? 'save');
          continue;
        }
        if (!q.document.number) await suggestQuoteNumber();
        const checked = quoteReadySchema.safeParse(q);
        if (!checked.success) {
          ui.show(quoteError(checked.error));
          continue;
        }
        const resolved = await resolveQuote(await client(), q);
        await assertNumberAvailable(
          await client(),
          'quote',
          q.document.number!,
        );
        ui.show(
          'Customer (Kunde): ' +
            contactLabel(resolved.customer) +
            '\nRecipient address (Empfängeradresse):\n' +
            resolved.payload.order.address,
        );
        if (action === 'send') {
          if (await editDelivery()) return { quote: q, send: true };
        } else if (
          await ui.confirm(
            'Save draft in sevdesk? (Entwurf in sevdesk speichern?)',
          )
        )
          return { quote: q, send: false };
      } else if (action.startsWith('position:')) {
        selectedPosition = Number(action.split(':')[1]);
        if (!q.positions[selectedPosition]) {
          cursor = 'add';
          continue;
        }
        await editPosition(selectedPosition);
        cursor = q.positions.length ? 'position:' + selectedPosition : 'add';
      }
    } catch (error) {
      if (error instanceof Cancelled) {
        try {
          if (await leave()) return;
        } catch (nested) {
          if (!(nested instanceof Cancelled)) ui.show(quoteError(nested));
        }
      } else ui.show(quoteError(error));
    }
  }
}

export { preview as quotePreview, summary as quoteSummary };
