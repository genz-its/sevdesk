import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { z } from 'zod';
import { requireClient } from '../../client';
import { requireNumberOption } from '../../options';
import { contactLabel, printJson } from '../../output';

export default defineCommand({
  description: 'Show a single credit note.',
  options: defineOptions(
    z.object({
      id: z.coerce
        .number()
        .optional()
        .describe('ID of the credit note. If omitted, you will be prompted.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const creditNoteId = await requireNumberOption({
      value: options.id,
      requirement: 'a credit note ID via --id',
      question: 'Enter the credit note ID:',
    });
    const creditNote = await client.creditNotes.get({
      creditNoteId,
      embed: ['contact'],
    });
    if (options.json) {
      printJson(creditNote);
      return;
    }
    consola.info(`ID: ${creditNote.id}`);
    consola.info(`Number: ${creditNote.creditNoteNumber ?? '-'}`);
    consola.info(`Date: ${creditNote.creditNoteDate}`);
    consola.info(`Status: ${creditNote.status}`);
    consola.info(`Contact: ${contactLabel(creditNote.contact)}`);
    consola.info(`Net: ${creditNote.sumNet}`);
    consola.info(`Tax: ${creditNote.sumTax}`);
    consola.info(`Gross: ${creditNote.sumGross}`);
    consola.info(`Currency: ${creditNote.currency ?? '-'}`);
  },
});
