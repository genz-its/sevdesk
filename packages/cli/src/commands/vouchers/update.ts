import { consola } from 'consola';
import { z } from 'zod';
import { defineCommand, defineOptions } from 'zodline';
import { requireClient } from '../../client';
import { requireNumberOption } from '../../options';
import { printJson } from '../../output';

export default defineCommand({
  description: 'Update the service period of a voucher.',
  options: defineOptions(
    z.object({
      id: z.coerce.number().optional().describe('ID of the voucher.'),
      deliveryDate: z
        .string()
        .optional()
        .describe(
          'Start of the service period, or the single service date, as dd.mm.yyyy or Unix timestamp.',
        ),
      deliveryDateUntil: z
        .string()
        .optional()
        .describe('End of the service period as dd.mm.yyyy or Unix timestamp.'),
      clearDeliveryDateUntil: z
        .boolean()
        .default(false)
        .describe(
          'Remove the end of the service period, leaving a single service date.',
        ),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    if (
      options.clearDeliveryDateUntil &&
      options.deliveryDateUntil !== undefined
    ) {
      consola.error(
        'You cannot use --delivery-date-until together with --clear-delivery-date-until.',
      );
      process.exit(1);
    }
    const client = await requireClient();
    const voucherId = await requireNumberOption({
      value: options.id,
      requirement: 'a voucher ID via --id',
      question: 'Enter the voucher ID:',
    });
    const voucher = await client.vouchers.update({
      voucherId,
      deliveryDate: options.deliveryDate,
      deliveryDateUntil: options.clearDeliveryDateUntil
        ? null
        : options.deliveryDateUntil,
    });
    if (options.json) {
      printJson(voucher);
      return;
    }
    consola.success(`Updated voucher ${voucher.id}.`);
  },
});
