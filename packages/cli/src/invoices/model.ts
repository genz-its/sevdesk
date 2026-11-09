import { z } from 'zod';

const id = z.number().int().positive();
const text = z.string().trim().min(1);
const date = z.iso
  .date()
  .transform((value) => value.split('-').reverse().join('.'));
const invoiceFields = z.strictObject({
  status: z.literal(100),
  invoiceType: z.literal('RE'),
  invoiceNumber: z.preprocess(
    (value) => (typeof value === 'string' && !value.trim() ? undefined : value),
    text.optional(),
  ),
  contactId: id,
  contactPersonId: id,
  invoiceDate: date,
  currency: z.string().regex(/^[A-Z]{3}$/),
  taxRuleId: id,
  taxText: text,
  showNet: z.boolean(),
  timeToPay: z.number().int().nonnegative(),
  deliveryDate: date,
  deliveryDateUntil: date.optional(),
  header: text.optional(),
  headText: z.string().optional(),
  footText: z.string().optional(),
  customerInternalNote: z.string().optional(),
  smallSettlement: z.boolean().optional(),
  paymentMethodId: id.optional(),
  address: z.string().optional(),
  addressCountryId: id.optional(),
});
const positions = z
  .array(
    z.strictObject({
      name: text,
      quantity: z.number().positive(),
      price: z.number().nonnegative(),
      taxRate: z.number().min(0).max(100),
      unityId: id,
      text: z.string().optional(),
      discount: z.number().min(0).max(100).optional(),
    }),
  )
  .min(1);

/** Accepts normalized dd.mm.yyyy dates, including merged stored dates on update. */
export function validateInvoiceDates(
  invoice: {
    invoiceDate?: string;
    deliveryDate?: string;
    deliveryDateUntil?: string;
  },
  ctx: z.RefinementCtx,
) {
  const iso = (value: string) => value.split('.').reverse().join('-');
  if (
    invoice.deliveryDate &&
    invoice.invoiceDate &&
    iso(invoice.deliveryDate) > iso(invoice.invoiceDate)
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['invoice', 'deliveryDate'],
      message:
        'A regular invoice cannot have a service date after its invoice date.',
    });
  }
  if (
    invoice.deliveryDateUntil &&
    ((invoice.deliveryDate &&
      iso(invoice.deliveryDateUntil) < iso(invoice.deliveryDate)) ||
      (invoice.invoiceDate &&
        iso(invoice.deliveryDateUntil) > iso(invoice.invoiceDate)))
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['invoice', 'deliveryDateUntil'],
      message:
        'Service period end must be between service start and invoice date.',
    });
  }
}
export const invoiceCreateSchema = z
  .strictObject({
    invoice: invoiceFields.extend({
      status: z.literal(100).default(100),
      invoiceType: z.literal('RE').default('RE'),
    }),
    positions,
  })
  .superRefine(({ invoice }, ctx) => validateInvoiceDates(invoice, ctx));

export const invoiceUpdateSchema = z
  .strictObject({
    invoice: invoiceFields
      .partial()
      .extend({ takeDefaultAddress: z.boolean().optional() }),
    positions: positions.optional(),
    takeDefaultAddress: z.boolean().optional(),
  })
  .superRefine(({ invoice }, ctx) => validateInvoiceDates(invoice, ctx));

export const invoiceDateCheck = z
  .object({
    invoiceDate: z.string().optional(),
    deliveryDate: z.string().optional(),
    deliveryDateUntil: z.string().optional(),
  })
  .superRefine(validateInvoiceDates);
