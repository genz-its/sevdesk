import { consola } from 'consola';
import { z } from 'zod';
import { defineCommand, defineOptions } from 'zodline';
import { requireClient } from '../../client';
import { printJson, printTable } from '../../output';
import { fetchAll } from '../../pagination';

export default defineCommand({
  description:
    'List booking accounts (AccountDatev). Covers only accounts visible in the sevdesk account picker; hidden accounts (for example some tax accounts) are reachable via accounts-datev:get. Backed by an undocumented sevdesk endpoint that may change without notice.',
  options: defineOptions(
    z.object({
      number: z
        .string()
        .optional()
        .describe(
          'Only show accounts with this account number. Filtered client-side across all visible accounts.',
        ),
      nameLike: z
        .string()
        .optional()
        .describe(
          'Only show accounts whose name contains this text. Filtered client-side across all visible accounts.',
        ),
      limit: z.coerce
        .number()
        .optional()
        .describe(
          'Maximum number of accounts to return. Defaults to all of them.',
        ),
      offset: z.coerce
        .number()
        .optional()
        .describe('Number of accounts to skip before filtering.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const needle = options.nameLike?.toLowerCase();
    const filtering = options.number !== undefined || needle !== undefined;
    const accounts = await fetchAll((page) => client.accountsDatev.list(page), {
      limit: options.limit,
      offset: options.offset,
      keep: filtering
        ? (account) =>
            (options.number === undefined ||
              account.number === options.number) &&
            (needle === undefined ||
              (account.name ?? '').toLowerCase().includes(needle))
        : undefined,
    });
    if (options.json) {
      printJson(accounts);
      return;
    }
    if (accounts.length === 0) {
      consola.info('No booking accounts found.');
      return;
    }
    printTable(
      accounts.map((account) => ({
        id: account.id,
        number: account.number ?? '',
        name: account.name ?? '',
        taxRate: account.taxRate ?? '',
        deprecated: account.deprecated ?? '',
        hidden: account.hidden ?? '',
      })),
    );
  },
});
