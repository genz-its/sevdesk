import { consola } from 'consola';
import { z } from 'zod';
import { defineCommand, defineOptions } from 'zodline';
import { idArgument } from '../../arguments';
import { requireClient } from '../../client';
import { invoiceSummary, requireDraft } from '../../invoices/workflow';
import { confirmOrAbort } from '../../options';
import { printJson } from '../../output';

export default defineCommand({
  description: 'Delete an unsent invoice draft. Refuses finalised invoices.',
  args: z.tuple([idArgument.describe('Invoice ID.')]),
  options: defineOptions(
    z.object({
      yes: z.boolean().default(false).describe('Confirm deleting this draft.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options, [invoiceId]) => {
    const client = await requireClient();
    const invoice = await client.invoices.get({
      invoiceId,
      embed: ['contact'],
    });
    requireDraft(invoice);
    if (
      !(await confirmOrAbort({
        message: `Permanently delete draft ${invoiceSummary(invoice)}?`,
        yes: options.yes,
        initial: false,
      }))
    )
      return;
    await client.invoices.delete({ invoiceId });
    if (options.json)
      printJson({
        deleted: true,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
      });
    else
      consola.success(
        `Deleted draft ${invoice.invoiceNumber ?? invoice.id} (ID ${invoice.id}).`,
      );
  },
});
