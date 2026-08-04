import type { AccountDatev } from '@genz-its/sevdesk-sdk';
import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { z } from 'zod';
import { requireClient } from '../../client';
import { printJson, printTable } from '../../output';

const PAGE_SIZE = 1000;

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
        .describe('Maximum number of accounts to return.'),
      offset: z.coerce
        .number()
        .optional()
        .describe('Number of accounts to skip. Ignored when a filter is used.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const filtering =
      options.number !== undefined || options.nameLike !== undefined;
    let accounts: AccountDatev[];
    if (filtering) {
      accounts = [];
      for (let offset = 0; ; offset += PAGE_SIZE) {
        const page = await client.accountsDatev.list({
          limit: PAGE_SIZE,
          offset,
        });
        accounts.push(...page);
        if (page.length < PAGE_SIZE) {
          break;
        }
      }
      if (options.number !== undefined) {
        accounts = accounts.filter(
          (account) => account.number === options.number,
        );
      }
      if (options.nameLike !== undefined) {
        const needle = options.nameLike.toLowerCase();
        accounts = accounts.filter((account) =>
          (account.name ?? '').toLowerCase().includes(needle),
        );
      }
      if (options.limit !== undefined) {
        accounts = accounts.slice(0, options.limit);
      }
    } else {
      accounts = await client.accountsDatev.list({
        limit: options.limit,
        offset: options.offset,
      });
    }
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
