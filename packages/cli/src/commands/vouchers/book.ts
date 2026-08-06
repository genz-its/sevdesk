import { consola } from 'consola';
import { z } from 'zod';
import { defineCommand, defineOptions } from 'zodline';
import { requireClient } from '../../client';
import { confirmOrAbort, requireNumberOption } from '../../options';
import { printJson } from '../../output';

export default defineCommand({
  description: 'Book a payment on a voucher.',
  options: defineOptions(
    z.object({
      id: z.coerce.number().optional().describe('ID of the voucher.'),
      amount: z.coerce
        .number()
        .optional()
        .describe(
          'Amount to book. Can also be a partial amount. The sign is derived from the voucher, so pass the amount as a positive number.',
        ),
      date: z
        .string()
        .default(() => new Date().toISOString())
        .describe('Booking date as ISO 8601. Defaults to now.'),
      type: z
        .enum(['FULL_PAYMENT', 'N', 'CB', 'O', 'OF', 'MTC'])
        .default('FULL_PAYMENT')
        .describe(
          'Type of the booking. Supported values are FULL_PAYMENT, N (partial), CB (cash discount), O (other), OF (reminder charges) and MTC (monetary traffic costs).',
        ),
      checkAccount: z.coerce
        .number()
        .optional()
        .describe('ID of the check account.'),
      transaction: z.coerce
        .number()
        .optional()
        .describe(
          'ID of the bank transaction to link. Required for online check accounts, omit for clearing accounts.',
        ),
      createFeed: z
        .boolean()
        .optional()
        .describe('Create a feed entry for the booking.'),
      yes: z.boolean().default(false).describe('Skip the confirmation prompt.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const voucherId = await requireNumberOption({
      value: options.id,
      requirement: 'a voucher via --id',
      question: 'Enter the voucher ID:',
    });
    const amount = await requireNumberOption({
      value: options.amount,
      requirement: 'an amount via --amount',
      question: 'Enter the amount to book:',
    });
    const checkAccountId = await requireNumberOption({
      value: options.checkAccount,
      requirement: 'a check account via --check-account',
      question: 'Enter the check account ID:',
    });
    const confirmed = await confirmOrAbort({
      message: `Book ${amount} on voucher ${voucherId}?`,
      yes: options.yes,
    });
    if (!confirmed) {
      return;
    }
    const voucher = await client.vouchers.get({ voucherId });
    const result = await client.vouchers.book({
      voucherId,
      amount:
        voucher.creditDebit === 'C' ? -Math.abs(amount) : Math.abs(amount),
      date: options.date,
      type: options.type,
      checkAccountId,
      checkAccountTransactionId: options.transaction,
      createFeed: options.createFeed,
    });
    if (options.json) {
      printJson(result);
      return;
    }
    consola.success(
      `Booked ${amount} on voucher ${voucherId}. Status changed from ${result.fromStatus} to ${result.toStatus}.`,
    );
  },
});
