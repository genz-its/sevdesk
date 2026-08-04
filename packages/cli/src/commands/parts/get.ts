import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { z } from 'zod';
import { requireClient } from '../../client';
import { requireNumberOption } from '../../options';
import { printJson } from '../../output';

export default defineCommand({
  description: 'Show a single part.',
  options: defineOptions(
    z.object({
      id: z.coerce
        .number()
        .optional()
        .describe('The part ID. If omitted, you will be prompted.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const partId = await requireNumberOption({
      value: options.id,
      requirement: 'a part ID via --id',
      question: 'Enter the part ID:',
    });
    const part = await client.parts.get({ partId });
    if (options.json) {
      printJson(part);
      return;
    }
    consola.info(`ID: ${part.id}`);
    consola.info(`Part number: ${part.partNumber}`);
    consola.info(`Name: ${part.name}`);
    consola.info(`Text: ${part.text ?? '-'}`);
    consola.info(`Price: ${part.price ?? '-'}`);
    consola.info(`Price net: ${part.priceNet ?? '-'}`);
    consola.info(`Price gross: ${part.priceGross ?? '-'}`);
    consola.info(`Tax rate: ${part.taxRate}`);
    consola.info(`Stock: ${part.stock}`);
    consola.info(`Status: ${part.status ?? '-'}`);
  },
});
