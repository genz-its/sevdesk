import { consola } from 'consola';
import { z } from 'zod';
import { defineCommand, defineOptions } from 'zodline';
import { requireClient } from '../../client';
import { confirmOrAbort, requireNumberOption } from '../../options';
import { printJson } from '../../output';

export default defineCommand({
  description: 'Reset a voucher to the draft status.',
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
      message: `Reset voucher ${voucherId} to draft? This unlinks existing payments.`,
      yes: options.yes,
      initial: false,
    });
    if (!confirmed) {
      return;
    }
    const voucher = await client.vouchers.resetToDraft({ voucherId });
    if (options.json) {
      printJson(voucher);
      return;
    }
    consola.success(
      `Reset voucher ${voucher.id}. New status: ${voucher.status ?? '-'}.`,
    );
  },
});
