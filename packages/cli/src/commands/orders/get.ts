import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { z } from 'zod';
import { requireClient } from '../../client';
import { requireNumberOption } from '../../options';
import { contactLabel, printJson } from '../../output';

export default defineCommand({
  description: 'Show a single order.',
  options: defineOptions(
    z.object({
      id: z.coerce
        .number()
        .optional()
        .describe('ID of the order. If omitted, you will be prompted.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const orderId = await requireNumberOption({
      value: options.id,
      requirement: 'an order ID via --id',
      question: 'Enter the order ID:',
    });
    const order = await client.orders.get({ orderId, embed: ['contact'] });
    if (options.json) {
      printJson(order);
      return;
    }
    consola.info(`ID: ${order.id}`);
    consola.info(`Number: ${order.orderNumber}`);
    consola.info(`Date: ${order.orderDate}`);
    consola.info(`Status: ${order.status}`);
    consola.info(`Contact: ${contactLabel(order.contact)}`);
    consola.info(`Net: ${order.sumNet}`);
    consola.info(`Tax: ${order.sumTax}`);
    consola.info(`Gross: ${order.sumGross}`);
    consola.info(`Currency: ${order.currency}`);
  },
});
