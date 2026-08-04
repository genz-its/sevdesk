import type { InvoiceStatus } from '@genz-its/sevdesk-sdk';
import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { z } from 'zod';
import { requireClient } from '../../client';
import { contactLabel, printJson, printTable } from '../../output';

export default defineCommand({
  description: 'List invoices.',
  options: defineOptions(
    z.object({
      status: z.coerce
        .number()
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
        .describe('Maximum number of invoices to return.'),
      offset: z.coerce
        .number()
        .optional()
        .describe('Number of invoices to skip.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const invoices = await client.invoices.list({
      status: options.status as InvoiceStatus | undefined,
      invoiceNumber: options.invoiceNumber,
      startDate: options.startDate,
      endDate: options.endDate,
      contactId: options.contact,
      limit: options.limit,
      offset: options.offset,
      embed: ['contact'],
    });
    if (options.json) {
      printJson(invoices);
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
