import type { OrderStatus } from '@genz-its/sevdesk-sdk';
import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { z } from 'zod';
import { requireClient } from '../../client';
import { printJson, printTable } from '../../output';

export default defineCommand({
  description: 'List orders.',
  options: defineOptions(
    z.object({
      status: z.coerce
        .number()
        .optional()
        .describe(
          'Filter by status: 100 draft, 200 delivered, 300 rejected, 500 accepted, 750 partially calculated, 1000 calculated.',
        ),
      orderNumber: z.string().optional().describe('Filter by order number.'),
      startDate: z
        .string()
        .optional()
        .describe(
          'Only orders on or after this date as dd.mm.yyyy or Unix timestamp.',
        ),
      endDate: z
        .string()
        .optional()
        .describe(
          'Only orders on or before this date as dd.mm.yyyy or Unix timestamp.',
        ),
      contact: z.coerce
        .number()
        .optional()
        .describe('ID of the contact whose orders to list.'),
      limit: z.coerce
        .number()
        .optional()
        .describe('Maximum number of orders to return.'),
      offset: z.coerce
        .number()
        .optional()
        .describe('Number of orders to skip.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const orders = await client.orders.list({
      status: options.status as OrderStatus | undefined,
      orderNumber: options.orderNumber,
      startDate: options.startDate,
      endDate: options.endDate,
      contactId: options.contact,
      limit: options.limit,
      offset: options.offset,
    });
    if (options.json) {
      printJson(orders);
      return;
    }
    if (orders.length === 0) {
      consola.info('No orders found.');
      return;
    }
    printTable(
      orders.map((order) => ({
        id: order.id,
        number: order.orderNumber,
        date: order.orderDate,
        contact: order.contact?.id ?? '',
        gross: order.sumGross,
        status: order.status,
      })),
    );
  },
});
