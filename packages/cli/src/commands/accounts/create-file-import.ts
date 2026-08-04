import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { z } from 'zod';
import { requireClient } from '../../client';
import { requireStringOption } from '../../options';
import { printJson } from '../../output';

export default defineCommand({
  description:
    'Create a check account that imports its transactions from files.',
  options: defineOptions(
    z.object({
      name: z
        .string()
        .optional()
        .describe(
          'The name of the check account. If omitted, you will be prompted.',
        ),
      importType: z
        .enum(['CSV', 'MT940'])
        .default('CSV')
        .describe(
          'The file format used to import transactions. Supported values are CSV and MT940.',
        ),
      accountingNumber: z.coerce
        .number()
        .optional()
        .describe('The booking account number of the check account.'),
      iban: z.string().optional().describe('The IBAN of the check account.'),
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
    const checkAccount = await client.checkAccounts.createFileImportAccount({
      name,
      importType: options.importType,
      accountingNumber: options.accountingNumber,
      iban: options.iban,
    });
    if (options.json) {
      printJson(checkAccount);
      return;
    }
    consola.success(`Created file import account ${checkAccount.id}.`);
  },
});
