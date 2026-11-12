import type { InvoiceStatus } from '@mi-skam/sevdesk-sdk';
import { consola } from 'consola';
import { z } from 'zod';
import { defineCommand, defineOptions } from 'zodline';
import { requireClient } from '../../client';
import { contactLabel, printJson, printTable } from '../../output';
import { fetchAll } from '../../pagination';

export default defineCommand({
  description: 'List invoices.',
  options: defineOptions(
    z.object({
      drafts: z
        .boolean()
        .optional()
        .describe(
          'Only draft invoices (status 100). Includes duplicate-number warnings in JSON.',
        ),
      status: z.coerce
        .number()
        .refine(
          (value) => [50, 100, 200, 750, 1000].includes(value),
          'Use status 50, 100, 200, 750 or 1000.',
        )
        .optional()
        .describe(
          'Filter by status: 50 deactivated recurring, 100 draft, 200 open, 750 partially paid, 1000 paid.',
        ),
      invoiceNumber: z
        .string()
        .optional()
        .describe('Filter by invoice number.'),
      startDate: z
        .string()
        .optional()
        .describe(
          'Only invoices on or after this date as dd.mm.yyyy or Unix timestamp.',
        ),
      endDate: z
        .string()
        .optional()
        .describe(
          'Only invoices on or before this date as dd.mm.yyyy or Unix timestamp.',
        ),
      contact: z.coerce
        .number()
        .optional()
        .describe('ID of the contact whose invoices to list.'),
      limit: z.coerce
        .number()
        .optional()
        .describe(
          'Maximum number of invoices to return. Defaults to all of them.',
        ),
      offset: z.coerce
        .number()
        .optional()
        .describe('Number of invoices to skip.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    if (
      options.drafts &&
      options.status !== undefined &&
      options.status !== 100
    )
      throw new Error(
        '--drafts cannot be combined with a status other than 100.',
      );
    const status = options.drafts ? 100 : options.status;
    const client = await requireClient();
    const invoices = await fetchAll(
      (page) =>
        client.invoices.list({
          status: status as InvoiceStatus | undefined,
          invoiceNumber: options.invoiceNumber,
          startDate: options.startDate,
          endDate: options.endDate,
          contactId: options.contact,
          embed: ['contact'],
          ...page,
        }),
      {
        limit: options.limit,
        offset: options.offset,
        keep:
          status === undefined
            ? undefined
            : (invoice) => invoice.status === String(status),
      },
    );
    const drafts = new Map<string, string[]>();
    for (const invoice of invoices) {
      if (invoice.status !== '100' || !invoice.invoiceNumber) continue;
      const ids = drafts.get(invoice.invoiceNumber) ?? [];
      ids.push(invoice.id);
      drafts.set(invoice.invoiceNumber, ids);
    }
    const warnings = [...drafts]
      .filter(([, ids]) => ids.length > 1)
      .map(
        ([number, ids]) =>
          `Duplicate draft invoice number ${number}: IDs ${ids.join(', ')}.`,
      );
    for (const warning of warnings) console.error(`Warning: ${warning}`);
    if (options.json) {
      // Preserve the existing array contract unless warnings or the new --drafts mode are requested.
      printJson(
        options.drafts || warnings.length ? { invoices, warnings } : invoices,
      );
      return;
    }
    if (invoices.length === 0) {
      consola.info('No invoices found.');
      return;
    }
    printTable(
      invoices.map((invoice) => ({
        id: invoice.id,
        number: invoice.invoiceNumber ?? '',
        date: invoice.invoiceDate,
        contact: contactLabel(invoice.contact),
        gross: invoice.sumGross,
        status: invoice.status,
      })),
    );
  },
});
