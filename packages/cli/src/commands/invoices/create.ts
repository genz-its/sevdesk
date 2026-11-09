import { consola } from 'consola';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { defineCommand, defineOptions } from 'zodline';
import { requireClient } from '../../client';
import { invoiceCreateSchema } from '../../invoices/model';
import { assertNumberAvailable, nextNumber } from '../../numbering';
import { confirmOrAbort } from '../../options';
import { printJson } from '../../output';

export { invoiceCreateSchema } from '../../invoices/model';
export default defineCommand({
  description:
    'Create a regular draft invoice from invoice.json. Never sends or finalizes it.',
  args: z.tuple([z.string().min(1).describe('invoice.json')]),
  options: defineOptions(
    z.object({
      dryRun: z
        .boolean()
        .default(false)
        .describe(
          'Validate and print the normalized payload without authentication or API calls.',
        ),
      yes: z
        .boolean()
        .default(false)
        .describe('Confirm creation of the draft invoice.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options, [file]) => {
    const input = invoiceCreateSchema.parse(
      JSON.parse(await readFile(file, 'utf8')),
    );
    const payload = {
      ...input,
      positions: input.positions.map((position, positionNumber) => ({
        ...position,
        positionNumber,
      })),
      takeDefaultAddress: true,
    };
    if (options.dryRun) {
      printJson({
        dryRun: true,
        payload,
        numbering: {
          mode: input.invoice.invoiceNumber ? 'explicit' : 'automatic',
          pending: !input.invoice.invoiceNumber,
          reserved: false,
        },
      });
      return;
    }
    if (
      !(await confirmOrAbort({
        message: `Create a draft invoice for contact ${input.invoice.contactId} with ${input.positions.length} position(s)?`,
        yes: options.yes,
        initial: false,
      }))
    )
      return;
    const client = await requireClient();
    const invoiceNumber =
      input.invoice.invoiceNumber ??
      (await nextNumber(client, 'invoice')).nextNumber;
    await assertNumberAvailable(client, 'invoice', invoiceNumber);
    const result = await client.invoices.save({
      ...payload,
      invoice: {
        ...payload.invoice,
        invoiceNumber,
        header: payload.invoice.header ?? `Rechnung Nr. ${invoiceNumber}`,
      },
    });
    if (options.json) {
      printJson(result);
      return;
    }
    consola.success(
      `Created draft invoice ${result.invoice.invoiceNumber ?? result.invoice.id} (ID ${result.invoice.id}). Not sent or finalized.`,
    );
  },
});
