import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { z } from 'zod';
import { requireClient } from '../../client';
import { requireNumberOption } from '../../options';
import { printJson } from '../../output';

export default defineCommand({
  description: 'Show a single transaction.',
  options: defineOptions(
    z.object({
      id: z.coerce
        .number()
        .optional()
        .describe('The transaction ID. If omitted, you will be prompted.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const transactionId = await requireNumberOption({
      value: options.id,
      requirement: 'a transaction ID via --id',
      question: 'Enter the transaction ID:',
    });
    const transaction = await client.transactions.get({ transactionId });
    if (options.json) {
      printJson(transaction);
      return;
    }
    consola.info(`ID: ${transaction.id}`);
    consola.info(`Value date: ${transaction.valueDate}`);
    consola.info(`Amount: ${transaction.amount}`);
    consola.info(`Payee: ${transaction.payeePayerName ?? '-'}`);
    consola.info(`Purpose: ${transaction.paymtPurpose ?? '-'}`);
    consola.info(`Status: ${transaction.status}`);
    consola.info(`Check account: ${transaction.checkAccount.id}`);
  },
});
