import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { requireClient } from '../../client';
import { printJson } from '../../output';

export default defineCommand({
  description: 'Export vouchers as a CSV file.',
  options: defineOptions(
    z.object({
      output: z
        .string()
        .optional()
        .describe(
          'Path to write the CSV file to. Defaults to the filename of the export.',
        ),
      limit: z.coerce
        .number()
        .optional()
        .describe('The maximum number of vouchers to export.'),
      startDate: z
        .string()
        .optional()
        .describe('Only export vouchers on or after this date (ISO 8601).'),
      endDate: z
        .string()
        .optional()
        .describe('Only export vouchers on or before this date (ISO 8601).'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const file = await client.exports.exportVouchersCsv({
      limit: options.limit,
      filter: { startDate: options.startDate, endDate: options.endDate },
    });
    const path = options.output ?? file.filename;
    await writeFile(
      path,
      file.base64Encoded ? Buffer.from(file.content, 'base64') : file.content,
    );
    if (options.json) {
      printJson({ filename: file.filename, path });
      return;
    }
    consola.success(`Saved ${path}.`);
  },
});
