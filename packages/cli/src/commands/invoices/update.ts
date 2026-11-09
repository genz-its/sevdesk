import { consola } from 'consola';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { defineCommand, defineOptions } from 'zodline';
import { idArgument } from '../../arguments';
import { requireClient } from '../../client';
import { invoiceDateCheck, invoiceUpdateSchema } from '../../invoices/model';
import { fetchInvoicePositions } from '../../invoices/positions';
import { invoiceSummary, requireDraft } from '../../invoices/workflow';
import { assertNumberAvailable } from '../../numbering';
import { confirmOrAbort } from '../../options';
import { printJson } from '../../output';

export default defineCommand({
  description:
    'Update an unsent invoice draft. Positions, if supplied, replace all existing positions.',
  args: z.tuple([
    idArgument.describe('Invoice ID.'),
    z.string().min(1).describe('invoice.json'),
  ]),
  options: defineOptions(
    z.object({
      dryRun: z
        .boolean()
        .default(false)
        .describe(
          'Validate input offline without authentication or API calls.',
        ),
      yes: z.boolean().default(false).describe('Confirm updating this draft.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options, [invoiceId, file]) => {
    const input = invoiceUpdateSchema.parse(
      JSON.parse(await readFile(file, 'utf8')),
    );
    const { takeDefaultAddress: nestedAddress, ...invoice } = input.invoice;
    if (
      nestedAddress !== undefined &&
      input.takeDefaultAddress !== undefined &&
      nestedAddress !== input.takeDefaultAddress
    )
      throw new Error('Conflicting takeDefaultAddress values.');
    const payload = {
      invoice: {
        ...invoice,
        id: invoiceId,
        objectName: 'Invoice' as const,
        mapAll: true as const,
      },
      invoicePosSave: input.positions?.map((position, positionNumber) => ({
        ...position,
        positionNumber,
      })),
      takeDefaultAddress: input.takeDefaultAddress ?? nestedAddress,
    };
    if (options.dryRun) {
      printJson({
        dryRun: true,
        payload,
        replacePositions: input.positions !== undefined,
        accountValidated: false,
        note: 'Stored dates, draft status and old position IDs will be checked online before saving.',
      });
      return;
    }
    const client = await requireClient();
    const current = await client.invoices.get({
      invoiceId,
      embed: ['contact'],
    });
    requireDraft(current);
    if (current.invoiceType !== 'RE')
      throw new Error(
        'Only regular invoice drafts (RE) can be updated by this command.',
      );
    const storedDate = (value: string | null) =>
      value ? value.slice(0, 10).split('-').reverse().join('.') : undefined;
    invoiceDateCheck.parse({
      invoiceDate: invoice.invoiceDate ?? storedDate(current.invoiceDate),
      deliveryDate: invoice.deliveryDate ?? storedDate(current.deliveryDate),
      deliveryDateUntil:
        invoice.deliveryDateUntil ?? storedDate(current.deliveryDateUntil),
    });
    if (
      !(await confirmOrAbort({
        message: `Update draft ${invoiceSummary(current)}${input.positions ? ' and replace ALL positions' : ''}?`,
        yes: options.yes,
        initial: false,
      }))
    )
      return;
    if (
      invoice.invoiceNumber &&
      invoice.invoiceNumber !== current.invoiceNumber
    )
      await assertNumberAvailable(client, 'invoice', invoice.invoiceNumber);
    const oldPositions =
      input.positions === undefined
        ? undefined
        : await fetchInvoicePositions(client, invoiceId);
    await client.invoices.save({
      ...payload,
      invoicePosDelete:
        oldPositions?.map((position) => ({
          id: Number(position.id),
          objectName: 'InvoicePos',
        })) ?? null,
    });
    const stored = await client.invoices.get({ invoiceId, embed: ['contact'] });
    if (options.json) printJson(stored);
    else consola.success(`Updated draft ${invoiceSummary(stored)}.`);
  },
});
