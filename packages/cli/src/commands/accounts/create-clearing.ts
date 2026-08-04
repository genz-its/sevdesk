import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { z } from 'zod';
import { requireClient } from '../../client';
import { requireStringOption } from '../../options';
import { printJson } from '../../output';

export default defineCommand({
  description: 'Create a clearing check account.',
  options: defineOptions(
    z.object({
      name: z
        .string()
        .optional()
        .describe(
          'The name of the check account. If omitted, you will be prompted.',
        ),
      accountingNumber: z.coerce
        .number()
        .optional()
        .describe('The booking account number of the check account.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const name = await requireStringOption({
      value: options.name,
      requirement: 'a name via --name',
      question: 'Enter the name of the check account:',
    });
    const checkAccount = await client.checkAccounts.createClearingAccount({
      name,
      accountingNumber: options.accountingNumber,
    });
    if (options.json) {
      printJson(checkAccount);
      return;
    }
    consola.success(`Created clearing account ${checkAccount.id}.`);
  },
});
