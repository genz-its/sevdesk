import type { CreditNoteStatus } from '@genz-its/sevdesk-sdk';
import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { z } from 'zod';
import { requireClient } from '../../client';
import { contactLabel, printJson, printTable } from '../../output';

export default defineCommand({
  description: 'List credit notes.',
  options: defineOptions(
    z.object({
      status: z.coerce
        .number()
        .optional()
        .describe(
          'Filter by status: 100 draft, 200 open, 750 partially paid, 1000 paid.',
        ),
      creditNoteNumber: z
        .string()
        .optional()
        .describe('Filter by credit note number.'),
      startDate: z
        .string()
        .optional()
        .describe(
          'Only credit notes on or after this date as dd.mm.yyyy or Unix timestamp.',
        ),
      endDate: z
        .string()
        .optional()
        .describe(
          'Only credit notes on or before this date as dd.mm.yyyy or Unix timestamp.',
        ),
      contact: z.coerce
        .number()
        .optional()
        .describe('ID of the contact whose credit notes to list.'),
      limit: z.coerce
        .number()
        .optional()
        .describe('Maximum number of credit notes to return.'),
      offset: z.coerce
        .number()
        .optional()
        .describe('Number of credit notes to skip.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const creditNotes = await client.creditNotes.list({
      status: options.status as CreditNoteStatus | undefined,
      creditNoteNumber: options.creditNoteNumber,
      startDate: options.startDate,
      endDate: options.endDate,
      contactId: options.contact,
      limit: options.limit,
      offset: options.offset,
      embed: ['contact'],
    });
    if (options.json) {
      printJson(creditNotes);
      return;
    }
    if (creditNotes.length === 0) {
      consola.info('No credit notes found.');
      return;
    }
    printTable(
      creditNotes.map((creditNote) => ({
        id: creditNote.id,
        number: creditNote.creditNoteNumber ?? '',
        date: creditNote.creditNoteDate,
        contact: contactLabel(creditNote.contact),
        gross: creditNote.sumGross,
        status: creditNote.status,
      })),
    );
  },
});
