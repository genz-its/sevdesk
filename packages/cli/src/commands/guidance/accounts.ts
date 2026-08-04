import type { AllowedTaxRule, ReceiptGuide } from '@genz-its/sevdesk-sdk';
import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { z } from 'zod';
import { requireClient } from '../../client';
import { printJson, printTable } from '../../output';

const MAX_TAX_RULES = 3;

function formatTaxRules(taxRules: AllowedTaxRule[]): string {
  const names = taxRules.map((taxRule) => taxRule.name);
  if (names.length > MAX_TAX_RULES) {
    return `${names.slice(0, MAX_TAX_RULES).join(', ')}, …`;
  }
  return names.join(', ');
}

export default defineCommand({
  description:
    'List bookable accounts and their allowed tax rules. Covers only the ReceiptGuidance subset of VAT-relevant accounts — use accounts-datev:list for all booking accounts. The first matching filter wins: --account-number, --tax-rule, --revenue, --expense. Without a filter, all accounts are listed.',
  options: defineOptions(
    z.object({
      accountNumber: z
        .string()
        .optional()
        .describe('Only show the account with this datev account number.'),
      taxRule: z
        .string()
        .optional()
        .describe('Tax rule name, for example USTPFL_UMS_EINN.'),
      revenue: z
        .boolean()
        .default(false)
        .describe('Only show accounts that can be used for revenue.'),
      expense: z
        .boolean()
        .default(false)
        .describe('Only show accounts that can be used for expenses.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    let guides: ReceiptGuide[];
    if (options.accountNumber) {
      guides = await client.receiptGuidance.forAccountNumber({
        accountNumber: options.accountNumber,
      });
    } else if (options.taxRule) {
      guides = await client.receiptGuidance.forTaxRule({
        taxRule: options.taxRule,
      });
    } else if (options.revenue) {
      guides = await client.receiptGuidance.forRevenue();
    } else if (options.expense) {
      guides = await client.receiptGuidance.forExpense();
    } else {
      guides = await client.receiptGuidance.forAllAccounts();
    }
    if (options.json) {
      printJson(guides);
      return;
    }
    if (guides.length === 0) {
      consola.info('No accounts found.');
      return;
    }
    printTable(
      guides.map((guide) => ({
        id: String(guide.accountDatevId),
        number: guide.accountNumber,
        name: guide.accountName,
        taxRules: formatTaxRules(guide.allowedTaxRules),
      })),
    );
  },
});
