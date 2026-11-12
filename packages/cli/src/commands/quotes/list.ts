import type { OrderStatus } from '@mi-skam/sevdesk-sdk';
import { consola } from 'consola';
import { z } from 'zod';
import { defineCommand, defineOptions } from 'zodline';
import { requireClient } from '../../client';
import { printJson, printTable } from '../../output';
import { fetchAll } from '../../pagination';

export default defineCommand({
  description: 'List quotes (Angebote), excluding other order types.',
  options: defineOptions(
    z.object({
      contact: z.coerce
        .number()
        .int()
        .positive()
        .optional()
        .describe('Customer contact ID (Kunden-ID).'),
      status: z.coerce
        .number()
        .refine(
          (value) => [100, 200, 300, 500, 750, 1000].includes(value),
          'Invalid quote status.',
        )
        .optional()
        .describe('Quote status (Angebotsstatus).'),
      limit: z.coerce
        .number()
        .int()
        .positive()
        .optional()
        .describe('Maximum matching quotes.'),
      json: z.boolean().default(false).describe('Machine-readable output.'),
    }),
  ),
  action: async (o) => {
    const client = await requireClient();
    const quotes = await fetchAll(
      (page) =>
        client.orders.list({
          contactId: o.contact,
          status: o.status as OrderStatus | undefined,
          ...page,
        }),
      { limit: o.limit, keep: (v) => v.orderType === 'AN' },
    );
    if (o.json) {
      printJson(quotes);
      return;
    }
    if (!quotes.length) {
      consola.info('No quotes (Keine Angebote).');
      return;
    }
    printTable(
      quotes.map((v) => ({
        id: v.id,
        number: v.orderNumber,
        date: v.orderDate,
        status: v.status,
        total: `${v.sumGross} ${v.currency}`,
      })),
    );
  },
});
