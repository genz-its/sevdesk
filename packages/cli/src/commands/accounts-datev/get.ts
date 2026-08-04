import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { z } from 'zod';
import { requireClient } from '../../client';
import { requireNumberOption } from '../../options';
import { printJson } from '../../output';

export default defineCommand({
  description:
    'Show a single booking account (AccountDatev), including hidden accounts that accounts-datev:list does not return. Backed by an undocumented sevdesk endpoint that may change without notice.',
  options: defineOptions(
    z.object({
      id: z.coerce
        .number()
        .optional()
        .describe('The booking account ID. If omitted, you will be prompted.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const accountDatevId = await requireNumberOption({
      value: options.id,
      requirement: 'a booking account via --id',
      question: 'Enter the booking account ID:',
    });
    const account = await client.accountsDatev.get({ accountDatevId });
    if (options.json) {
      printJson(account);
      return;
    }
    consola.info(`ID: ${account.id}`);
    consola.info(`Number: ${account.number ?? '-'}`);
    consola.info(`Name: ${account.name ?? '-'}`);
    consola.info(`Tax rate: ${account.taxRate ?? '-'}`);
    consola.info(`Deprecated: ${account.deprecated ?? '-'}`);
    consola.info(`Hidden: ${account.hidden ?? '-'}`);
    consola.info(`Deactivated: ${account.deactivated ?? '-'}`);
  },
});
