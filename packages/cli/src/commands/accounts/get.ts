import { consola } from 'consola';
import { z } from 'zod';
import { defineCommand, defineOptions } from 'zodline';
import { requireClient } from '../../client';
import { requireNumberOption } from '../../options';
import { printJson } from '../../output';

export default defineCommand({
  description: 'Show a single check account.',
  options: defineOptions(
    z.object({
      id: z.coerce
        .number()
        .optional()
        .describe('The check account ID. If omitted, you will be prompted.'),
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
    const checkAccount = await client.checkAccounts.get({ checkAccountId });
    if (options.json) {
      printJson(checkAccount);
      return;
    }
    consola.info(`ID: ${checkAccount.id}`);
    consola.info(`Name: ${checkAccount.name}`);
    consola.info(`Type: ${checkAccount.type}`);
    consola.info(`Import type: ${checkAccount.importType ?? '-'}`);
    consola.info(`IBAN: ${checkAccount.iban ?? '-'}`);
    consola.info(`Accounting number: ${checkAccount.accountingNumber ?? '-'}`);
    consola.info(`Currency: ${checkAccount.currency}`);
    consola.info(`Balance: ${checkAccount.balance ?? '-'}`);
    consola.info(`Status: ${checkAccount.status}`);
  },
});
