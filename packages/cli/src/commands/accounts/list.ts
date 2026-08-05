import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { z } from 'zod';
import { requireClient } from '../../client';
import { printJson, printTable } from '../../output';
import { fetchAll } from '../../pagination';

export default defineCommand({
  description: 'List your check accounts.',
  options: defineOptions(
    z.object({
      limit: z.coerce
        .number()
        .optional()
        .describe(
          'The maximum number of check accounts to return. Defaults to all of them.',
        ),
      offset: z.coerce
        .number()
        .optional()
        .describe('The number of check accounts to skip.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const checkAccounts = await fetchAll(
      (page) => client.checkAccounts.list(page),
      { limit: options.limit, offset: options.offset },
    );
    if (options.json) {
      printJson(checkAccounts);
      return;
    }
    if (checkAccounts.length === 0) {
      consola.info('No check accounts found.');
      return;
    }
    printTable(
      checkAccounts.map((checkAccount) => ({
        id: checkAccount.id,
        name: checkAccount.name,
        type: checkAccount.type,
        importType: checkAccount.importType ?? '',
        accountingNumber: checkAccount.accountingNumber ?? '',
        currency: checkAccount.currency,
        status: checkAccount.status,
      })),
    );
  },
});
