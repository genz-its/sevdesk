import { Decimal } from 'decimal.js';
import { z } from 'zod';
import { deliverySchema } from '../delivery';
export { deliverySchema, html } from '../delivery';

const id = z.number().int().positive();
const nonempty = z.string().trim().min(1);
const decimal = z
  .string()
  .max(20)
  .regex(
    /^\d{1,12}(?:\.\d{1,4})?$/,
    'Use a non-negative decimal string with at most 12 integer digits and four decimal places.',
  );
const percent = decimal.refine(
  (v) => new Decimal(v).lte(100),
  'Must not exceed 100%.',
);
const customer = z.union([
  z.strictObject({ id }),
  z.strictObject({ number: nonempty }),
]);
export const positionSchema = z.strictObject({
  name: nonempty,
  description: z.string().optional(),
  quantity: decimal.refine((v) => new Decimal(v).gt(0), 'Must be positive.'),
  unit: z.strictObject({ id, label: nonempty.optional() }),
  unitPrice: decimal,
  vatRate: percent,
  discount: percent.optional(),
  optional: z.boolean().optional(),
});
const document = z.strictObject({
  number: z.preprocess(
    (value) => (typeof value === 'string' && !value.trim() ? undefined : value),
    nonempty.optional(),
  ),
  date: z.iso.date().optional(),
  validUntil: z.iso.date().optional(),
  heading: nonempty.optional(),
  currency: z
    .string()
    .refine(
      (v) =>
        Intl.supportedValuesOf('currency').includes(v) &&
        new Intl.NumberFormat('en', {
          style: 'currency',
          currency: v,
        }).resolvedOptions().maximumFractionDigits === 2,
      'Use a supported currency with two decimal places.',
    )
    .optional(),
  priceMode: z.enum(['net', 'gross']).optional(),
  contactPersonId: id.optional(),
  customerReference: z.string().optional(),
  smallSettlement: z.boolean().optional(),
});
export const quoteDraftSchema = z.strictObject({
  schemaVersion: z.literal(1),
  customer: customer.nullable().default(null),
  recipient: z.strictObject({ address: nonempty, countryId: id }).optional(),
  document: document.default({}),
  tax: z
    .strictObject({ ruleId: id.optional(), text: nonempty.optional() })
    .default({}),
  positions: z.array(positionSchema).default([]),
  texts: z
    .strictObject({
      introduction: z.string().optional(),
      closing: z.string().optional(),
    })
    .default({}),
  terms: z
    .strictObject({
      payment: z.string().optional(),
      delivery: z.string().optional(),
    })
    .default({}),
  delivery: deliverySchema.partial().default({}),
});
export type QuoteDraft = z.infer<typeof quoteDraftSchema>;
export type Position = z.infer<typeof positionSchema>;
export type Delivery = z.infer<typeof deliverySchema>;

function readySchema(requireNumber: boolean) {
  return quoteDraftSchema.superRefine((q, ctx) => {
    const required = (value: unknown, path: (string | number)[]) => {
      if (value === undefined || value === null || value === '')
        ctx.addIssue({
          code: 'custom',
          path,
          message:
            'Required before saving in sevdesk (Zum Speichern erforderlich).',
        });
    };
    required(q.customer, ['customer']);
    for (const key of [
      ...(requireNumber ? ['number' as const] : []),
      'date',
      'heading',
      'currency',
      'priceMode',
      'contactPersonId',
    ] as const)
      required(q.document[key], ['document', key]);
    required(q.tax.ruleId, ['tax', 'ruleId']);
    required(q.tax.text, ['tax', 'text']);
    if (!q.positions.length)
      ctx.addIssue({
        code: 'custom',
        path: ['positions'],
        message: 'Add at least one position (Position).',
      });
    if (
      q.document.validUntil &&
      q.document.date &&
      q.document.validUntil < q.document.date
    )
      ctx.addIssue({
        code: 'custom',
        path: ['document', 'validUntil'],
        message: 'Must not precede the quote date (Angebotsdatum).',
      });
    if (
      q.document.smallSettlement &&
      q.positions.some((p) => new Decimal(p.vatRate).gt(0))
    )
      ctx.addIssue({
        code: 'custom',
        path: ['positions'],
        message:
          'Small entrepreneur scheme (Kleinunternehmerregelung) requires zero VAT.',
      });
  });
}
export const quoteReadySchema = readySchema(true);
/** Valid locally except for a number that will be resolved with read-only account lookups. */
export const quoteAutoNumberSchema = readySchema(false);

export function emptyQuote(): QuoteDraft {
  return quoteDraftSchema.parse({ schemaVersion: 1 });
}

export function totals(q: QuoteDraft) {
  let net = new Decimal(0),
    vat = new Decimal(0);
  const positions = q.positions.map((p) => {
    const amount = new Decimal(p.unitPrice)
      .mul(p.quantity)
      .mul(new Decimal(100).minus(p.discount ?? '0'))
      .div(100)
      .toDecimalPlaces(2);
    const rate = new Decimal(p.vatRate).div(100);
    const base =
      q.document.priceMode === 'gross'
        ? amount.div(rate.plus(1)).toDecimalPlaces(2)
        : amount;
    const tax =
      q.document.priceMode === 'gross'
        ? amount.minus(base)
        : base.mul(rate).toDecimalPlaces(2);
    if (!p.optional) {
      net = net.plus(base);
      vat = vat.plus(tax);
    }
    return {
      name: p.name,
      optional: p.optional ?? false,
      net: base.toFixed(2),
      vat: tax.toFixed(2),
      gross: base.plus(tax).toFixed(2),
    };
  });
  return {
    net: net.toFixed(2),
    vat: vat.toFixed(2),
    gross: net.plus(vat).toFixed(2),
    positions,
    indicative: true,
    note: 'Preview (Vorschau); optional positions excluded. sevdesk totals remain authoritative.',
  };
}

export function preview(q: QuoteDraft) {
  const checked = quoteReadySchema.safeParse(q);
  return {
    quote: q,
    totals: totals(q),
    readyToSave: checked.success,
    issues: checked.success
      ? []
      : checked.error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
        })),
    accountValidated: false,
  };
}
