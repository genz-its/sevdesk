import type { VoucherPosition } from '@genz-its/sevdesk-sdk';
import { consola } from 'consola';
import { z } from 'zod';
import { defineCommand, defineOptions } from 'zodline';
import { requireClient } from '../../client';
import { requireNumberOption } from '../../options';
import { printJson } from '../../output';
import { fetchAll } from '../../pagination';

export default defineCommand({
  description: 'Move a draft voucher to the open status.',
  options: defineOptions(
    z.object({
      id: z.coerce.number().optional().describe('ID of the voucher.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const voucherId = await requireNumberOption({
      value: options.id,
      requirement: 'a voucher ID via --id',
      question: 'Enter the voucher ID:',
    });
    const voucher = await client.vouchers.get({ voucherId });
    if (voucher.status !== '50' || voucher.enshrined) {
      consola.error(
        `Voucher ${voucherId} is not an unenshrined draft (status ${voucher.status ?? '-'}). Only drafts can be opened.`,
      );
      process.exit(1);
    }
    const positions = await fetchAll((page) =>
      client.vouchers.listPositions({ voucherId, ...page }),
    );
    if (positions.some((position) => position.accountDatev === null)) {
      consola.error(
        `Voucher ${voucherId} has legacy bookkeeping-1.0 positions, which cannot be saved.`,
      );
      process.exit(1);
    }
    const result = await client.vouchers.save({
      voucher: {
        id: voucherId,
        status: 100,
        creditDebit: voucher.creditDebit as 'C' | 'D',
        taxRuleId: Number(voucher.taxRule.id),
        voucherType: voucher.voucherType as 'VOU' | 'RV',
      },
      positions: positions.map(toUnchangedPositionInput),
    });
    if (options.json) {
      printJson({ id: result.voucher.id, status: result.voucher.status });
      return;
    }
    consola.success(
      `Opened voucher ${result.voucher.id}. New status: ${result.voucher.status ?? '-'}.`,
    );
  },
});

function toUnchangedPositionInput(position: VoucherPosition) {
  return {
    id: Number(position.id),
    accountDatevId: Number(position.accountDatev?.id),
    taxRate: Number(position.taxRate),
    net: position.net === '1',
    sumNet: Number(position.sumNet),
    sumGross: Number(position.sumGross),
  };
}
