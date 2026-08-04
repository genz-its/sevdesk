import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { z } from 'zod';
import { requireClient } from '../../client';
import { requireNumberOption } from '../../options';
import { printJson } from '../../output';

export default defineCommand({
  description: 'Show a single invoice.',
  options: defineOptions(
    z.object({
      id: z.coerce
        .number()
        .optional()
        .describe('ID of the invoice. If omitted, you will be prompted.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const invoiceId = await requireNumberOption({
      value: options.id,
      requirement: 'an invoice ID via --id',
      question: 'Enter the invoice ID:',
    });
    const invoice = await client.invoices.get({ invoiceId });
    if (options.json) {
      printJson(invoice);
      return;
    }
    consola.info(`ID: ${invoice.id}`);
    consola.info(`Number: ${invoice.invoiceNumber ?? '-'}`);
    consola.info(`Date: ${invoice.invoiceDate}`);
    consola.info(`Status: ${invoice.status}`);
    consola.info(`Contact: ${invoice.contact?.id ?? '-'}`);
    consola.info(`Net: ${invoice.sumNet}`);
    consola.info(`Tax: ${invoice.sumTax}`);
    consola.info(`Gross: ${invoice.sumGross}`);
    consola.info(`Currency: ${invoice.currency}`);
  },
});
