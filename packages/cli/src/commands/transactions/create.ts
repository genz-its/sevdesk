import type { TransactionStatus } from '@genz-its/sevdesk-sdk';
import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { z } from 'zod';
import { requireClient } from '../../client';
import { requireNumberOption, requireStringOption } from '../../options';
import { printJson } from '../../output';

/**
 * Creates a transaction manually. This should only be used on check accounts
 * of type online, preferably on accounts that import their transactions from
 * files, because transactions of connected bank accounts are synchronized by
 * sevdesk itself.
 */
export default defineCommand({
  description:
    'Create a transaction. Only use this on file import (online) check accounts.',
  options: defineOptions(
    z.object({
      checkAccount: z.coerce
        .number()
        .optional()
        .describe(
          'The ID of the check account the transaction belongs to. If omitted, you will be prompted.',
        ),
      amount: z.coerce
        .number()
        .optional()
        .describe(
          'The amount of the transaction. Negative for expenses. If omitted, you will be prompted.',
        ),
      payee: z
        .string()
        .optional()
        .describe(
          'The name of the payee or payer. If omitted, you will be prompted.',
        ),
      valueDate: z
        .string()
        .default(() => new Date().toISOString())
        .describe('The date the transaction was booked (ISO 8601).'),
      entryDate: z
        .string()
        .optional()
        .describe('The date the transaction was imported (ISO 8601).'),
      purpose: z
        .string()
        .optional()
        .describe('The payment purpose of the transaction.'),
      status: z.coerce
        .number()
        .default(100)
        .describe('100 created, 200 linked, 300 private, 400 booked.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const checkAccountId = await requireNumberOption({
      value: options.checkAccount,
      requirement: 'a check account ID via --check-account',
      question: 'Enter the check account ID:',
    });
    const amount = await requireNumberOption({
      value: options.amount,
      requirement: 'an amount via --amount',
      question: 'Enter the amount:',
    });
    const payee = await requireStringOption({
      value: options.payee,
      requirement: 'a payee via --payee',
      question: 'Enter the payee or payer name:',
    });
    const transaction = await client.transactions.create({
      checkAccountId,
      amount,
      payeePayerName: payee,
      valueDate: options.valueDate,
      entryDate: options.entryDate,
      paymtPurpose: options.purpose,
      status: options.status as TransactionStatus,
    });
    if (options.json) {
      printJson(transaction);
      return;
    }
    consola.success(`Created transaction ${transaction.id}.`);
  },
});
