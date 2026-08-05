import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { z } from 'zod';
import { requireClient } from '../../client';
import { printJson, printTable } from '../../output';
import { fetchAll } from '../../pagination';

export default defineCommand({
  description: 'List tags.',
  options: defineOptions(
    z.object({
      limit: z.coerce
        .number()
        .optional()
        .describe('Maximum number of tags to return. Defaults to all of them.'),
      offset: z.coerce.number().optional().describe('Number of tags to skip.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const tags = await fetchAll((page) => client.tags.list(page), {
      limit: options.limit,
      offset: options.offset,
    });
    if (options.json) {
      printJson(tags);
      return;
    }
    if (tags.length === 0) {
      consola.info('No tags found.');
      return;
    }
    printTable(tags.map((tag) => ({ id: tag.id, name: tag.name })));
  },
});
