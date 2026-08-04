import type { ModelRefResponse } from '@genz-its/sevdesk-sdk';
import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { z } from 'zod';
import { requireClient } from '../../client';
import { printJson, printTable } from '../../output';

/**
 * The booking account of a position. The number and name fields are only
 * present when the reference was inflated with the `embed` query parameter.
 */
interface AccountDatevLike extends ModelRefResponse {
  number?: string | number | null;
  accountNumber?: string | number | null;
  name?: string | null;
  accountName?: string | null;
}

export default defineCommand({
  description: 'List voucher positions.',
  options: defineOptions(
    z.object({
      voucher: z.coerce
        .number()
        .optional()
        .describe('ID of the voucher whose positions to list.'),
      limit: z.coerce
        .number()
        .optional()
        .describe('Maximum number of positions to return.'),
      offset: z.coerce
        .number()
        .optional()
        .describe('Number of positions to skip.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const positions = await client.vouchers.listPositions({
      voucherId: options.voucher,
      limit: options.limit,
      offset: options.offset,
      embed: ['accountDatev'],
    });
    if (options.json) {
      printJson(positions);
      return;
    }
    if (positions.length === 0) {
      consola.info('No voucher positions found.');
      return;
    }
    printTable(
      positions.map((position) => ({
        id: position.id,
        voucher: position.voucher.id,
        account: accountLabel(position.accountDatev),
        taxRate: position.taxRate,
        net: String(position.net),
        sumNet: position.sumNet,
        sumGross: position.sumGross,
      })),
    );
  },
});

function accountLabel(account: AccountDatevLike): string {
  const parts = [
    account.number ?? account.accountNumber,
    account.name ?? account.accountName,
  ].filter((part) => part !== undefined && part !== null && part !== '');
  return parts.length === 0 ? account.id : parts.join(' ');
}
