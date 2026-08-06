import { consola } from 'consola';
import { z } from 'zod';
import { defineCommand, defineOptions } from 'zodline';
import { requireClient } from '../../client';
import { requireNumberOption } from '../../options';
import { printJson } from '../../output';

export default defineCommand({
  description: 'Show the balance of a check account at a given date.',
  options: defineOptions(
    z.object({
      id: z.coerce
        .number()
        .optional()
        .describe('The check account ID. If omitted, you will be prompted.'),
      date: z
        .string()
        .default(() => new Date().toISOString().slice(0, 10))
        .describe('The date to calculate the balance for (YYYY-MM-DD).'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const checkAccountId = await requireNumberOption({
      value: options.id,
      requirement: 'a check account ID via --id',
      question: 'Enter the check account ID:',
    });
    const balance = await client.checkAccounts.getBalanceAtDate({
      checkAccountId,
      date: options.date,
    });
    if (options.json) {
      printJson({ checkAccountId, date: options.date, balance });
      return;
    }
    consola.info(`Balance at ${options.date}: ${balance}`);
  },
});
