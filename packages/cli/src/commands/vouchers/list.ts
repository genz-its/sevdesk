import type { VoucherStatus } from '@genz-its/sevdesk-sdk';
import { consola } from 'consola';
import { z } from 'zod';
import { defineCommand, defineOptions } from 'zodline';
import { requireClient } from '../../client';
import {
  contactLabel,
  printJson,
  printTable,
  servicePeriodLabel,
} from '../../output';
import { fetchAll } from '../../pagination';

export default defineCommand({
  description: 'List vouchers.',
  options: defineOptions(
    z.object({
      status: z.coerce
        .number()
        .optional()
        .describe(
          'Filter by status: 50 draft, 100 open, 150 transferred, 750 partially paid, 1000 paid.',
        ),
      creditDebit: z
        .enum(['C', 'D'])
        .optional()
        .describe('Filter by C for expense or D for income vouchers.'),
      descriptionLike: z
        .string()
        .optional()
        .describe('Filter by voucher number, matching partially.'),
      startDate: z
        .string()
        .optional()
        .describe(
          'Only vouchers on or after this date as dd.mm.yyyy or Unix timestamp.',
        ),
      endDate: z
        .string()
        .optional()
        .describe(
          'Only vouchers on or before this date as dd.mm.yyyy or Unix timestamp.',
        ),
      contact: z.coerce
        .number()
        .optional()
        .describe('ID of the contact whose vouchers to list.'),
      limit: z.coerce
        .number()
        .optional()
        .describe(
          'Maximum number of vouchers to return. Defaults to all of them.',
        ),
      offset: z.coerce
        .number()
        .optional()
        .describe('Number of vouchers to skip.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const vouchers = await fetchAll(
      (page) =>
        client.vouchers.list({
          status: options.status as VoucherStatus | undefined,
          creditDebit: options.creditDebit,
          descriptionLike: options.descriptionLike,
          startDate: options.startDate,
          endDate: options.endDate,
          contactId: options.contact,
          embed: ['supplier'],
          ...page,
        }),
      { limit: options.limit, offset: options.offset },
    );
    if (options.json) {
      printJson(vouchers);
      return;
    }
    if (vouchers.length === 0) {
      consola.info('No vouchers found.');
      return;
    }
    printTable(
      vouchers.map((voucher) => ({
        id: voucher.id,
        date: voucher.voucherDate ?? '',
        servicePeriod: servicePeriodLabel(
          voucher.deliveryDate,
          voucher.deliveryDateUntil,
        ),
        supplier: voucher.supplierName ?? contactLabel(voucher.supplier),
        description: voucher.description ?? '',
        gross: voucher.sumGross,
        status: voucher.status ?? '',
      })),
    );
  },
});
