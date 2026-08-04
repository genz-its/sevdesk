import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { z } from 'zod';
import { requireClient } from '../../client';
import { requireNumberOption, requireStringOption } from '../../options';
import { printJson } from '../../output';

export default defineCommand({
  description: 'Create a voucher from a receipt file.',
  options: defineOptions(
    z.object({
      file: z
        .string()
        .optional()
        .describe(
          'Path to the receipt file to attach, for example a PDF, an image or an XML invoice.',
        ),
      status: z
        .enum(['draft', 'open'])
        .default('open')
        .describe(
          'Status of the created voucher. Supported values are draft and open.',
        ),
      creditDebit: z
        .enum(['C', 'D'])
        .default('C')
        .describe('C for expense (credit), D for income (debit) vouchers.'),
      taxRule: z.coerce
        .number()
        .optional()
        .describe(
          'ID of the tax rule, for example 9 for deductible input tax expenses.',
        ),
      accountDatev: z.coerce
        .number()
        .optional()
        .describe(
          'ID of the booking account (AccountDatev). Find it with guidance:accounts.',
        ),
      amount: z.coerce
        .number()
        .optional()
        .describe('Amount of the voucher position.'),
      net: z
        .boolean()
        .default(false)
        .describe('Treat the amount as net instead of gross.'),
      taxRate: z.coerce
        .number()
        .default(19)
        .describe('Tax rate of the voucher position in percent.'),
      voucherDate: z
        .string()
        .optional()
        .describe('Date as dd.mm.yyyy or Unix timestamp.'),
      payDate: z
        .string()
        .optional()
        .describe('Date as dd.mm.yyyy or Unix timestamp.'),
      supplierId: z.coerce
        .number()
        .optional()
        .describe('ID of the supplier contact.'),
      supplierName: z
        .string()
        .optional()
        .describe('Name of the supplier, used when no supplier ID is given.'),
      description: z.string().optional().describe('The voucher number.'),
      comment: z
        .string()
        .optional()
        .describe('Comment for the voucher position.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const path = await requireStringOption({
      value: options.file,
      requirement: 'a file via --file',
      question: 'Enter the path to the receipt file:',
    });
    const taxRuleId = await requireNumberOption({
      value: options.taxRule,
      requirement: 'a tax rule via --tax-rule',
      question: 'Enter the tax rule ID:',
    });
    const accountDatevId = await requireNumberOption({
      value: options.accountDatev,
      requirement: 'a booking account via --account-datev',
      question: 'Enter the booking account ID:',
    });
    const amount = await requireNumberOption({
      value: options.amount,
      requirement: 'an amount via --amount',
      question: 'Enter the amount:',
    });
    const supplierName =
      options.supplierId === undefined && !options.supplierName
        ? await requireStringOption({
            value: undefined,
            requirement: 'a supplier via --supplier-id or --supplier-name',
            question: 'Enter the supplier name:',
          })
        : options.supplierName;
    const file = await readFile(path).catch(() => {
      consola.error(
        `The file "${path}" could not be read. Check that the path is correct.`,
      );
      process.exit(1);
    });
    const result = await client.vouchers.createFromFile({
      file,
      filename: basename(path),
      voucher: {
        status: options.status === 'draft' ? 50 : 100,
        creditDebit: options.creditDebit,
        taxRuleId,
        voucherDate: options.voucherDate,
        payDate: options.payDate,
        supplierId: options.supplierId,
        supplierName,
        description: options.description,
      },
      positions: [
        {
          accountDatevId,
          taxRate: options.taxRate,
          net: options.net,
          ...(options.net ? { sumNet: amount } : { sumGross: amount }),
          comment: options.comment,
        },
      ],
    });
    if (options.json) {
      printJson(result);
      return;
    }
    consola.success(
      `Created voucher ${result.voucher.id} with status ${result.voucher.status}.`,
    );
  },
});
