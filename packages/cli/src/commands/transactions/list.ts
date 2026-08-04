import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { z } from 'zod';
import { requireClient } from '../../client';
import { printJson, printTable } from '../../output';

export default defineCommand({
  description: 'List transactions of your check accounts.',
  options: defineOptions(
    z.object({
      checkAccount: z.coerce
        .number()
        .optional()
        .describe('Only show transactions of this check account ID.'),
      unbooked: z
        .boolean()
        .default(false)
        .describe('Only show transactions that are not yet booked.'),
      startDate: z
        .string()
        .optional()
        .describe('Only show transactions on or after this date (ISO 8601).'),
      endDate: z
        .string()
        .optional()
        .describe('Only show transactions on or before this date (ISO 8601).'),
      payee: z
        .string()
        .optional()
        .describe('Only show transactions with this payee or payer name.'),
      purpose: z
        .string()
        .optional()
        .describe('Only show transactions with this payment purpose.'),
      limit: z.coerce
        .number()
        .optional()
        .describe('The maximum number of transactions to return.'),
      offset: z.coerce
        .number()
        .optional()
        .describe('The number of transactions to skip.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const transactions = await client.transactions.list({
      checkAccountId: options.checkAccount,
      isBooked: options.unbooked ? false : undefined,
      startDate: options.startDate,
      endDate: options.endDate,
      payeePayerName: options.payee,
      paymtPurpose: options.purpose,
      limit: options.limit,
      offset: options.offset,
    });
    if (options.json) {
      printJson(transactions);
      return;
    }
    if (transactions.length === 0) {
      consola.info('No transactions found.');
      return;
    }
    printTable(
      transactions.map((transaction) => ({
        id: transaction.id,
        valueDate: transaction.valueDate,
        payee: transaction.payeePayerName ?? '',
        purpose: transaction.paymtPurpose ?? '',
        amount: transaction.amount,
        status: transaction.status,
      })),
    );
  },
});
