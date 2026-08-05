import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { z } from 'zod';
import { requireClient } from '../../client';
import { printJson, printTable } from '../../output';
import { fetchAll } from '../../pagination';

export default defineCommand({
  description: 'List parts.',
  options: defineOptions(
    z.object({
      name: z.string().optional().describe('Filter by part name.'),
      partNumber: z.string().optional().describe('Filter by part number.'),
      limit: z.coerce
        .number()
        .optional()
        .describe(
          'Maximum number of parts to return. Defaults to all of them.',
        ),
      offset: z.coerce.number().optional().describe('Number of parts to skip.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const parts = await fetchAll(
      (page) =>
        client.parts.list({
          name: options.name,
          partNumber: options.partNumber,
          ...page,
        }),
      { limit: options.limit, offset: options.offset },
    );
    if (options.json) {
      printJson(parts);
      return;
    }
    if (parts.length === 0) {
      consola.info('No parts found.');
      return;
    }
    printTable(
      parts.map((part) => ({
        id: part.id,
        partNumber: part.partNumber,
        name: part.name,
        price: part.price ?? '',
        taxRate: part.taxRate,
        status: part.status ?? '',
        stock: part.stock,
      })),
    );
  },
});
