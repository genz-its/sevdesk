import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { z } from 'zod';
import { requireClient } from '../../client';
import { confirmOrAbort, requireNumberOption } from '../../options';
import { printJson } from '../../output';

export default defineCommand({
  description: 'Enshrine a voucher so that it can no longer be changed.',
  options: defineOptions(
    z.object({
      id: z.coerce.number().optional().describe('ID of the voucher.'),
      yes: z.boolean().default(false).describe('Skip the confirmation prompt.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const voucherId = await requireNumberOption({
      value: options.id,
      requirement: 'a voucher ID via --id',
      question: 'Enter the voucher ID:',
    });
    const confirmed = await confirmOrAbort({
      message: `Enshrine voucher ${voucherId}? This cannot be undone.`,
      yes: options.yes,
      initial: false,
    });
    if (!confirmed) {
      return;
    }
    await client.vouchers.enshrine({ voucherId });
    if (options.json) {
      printJson({ enshrined: true });
      return;
    }
    consola.success(`Enshrined voucher ${voucherId}.`);
  },
});
