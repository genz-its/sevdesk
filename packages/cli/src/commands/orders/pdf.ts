import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { requireClient } from '../../client';
import { requireNumberOption } from '../../options';
import { printJson } from '../../output';

export default defineCommand({
  description: 'Download the PDF of an order.',
  options: defineOptions(
    z.object({
      id: z.coerce
        .number()
        .optional()
        .describe('ID of the order. If omitted, you will be prompted.'),
      output: z
        .string()
        .optional()
        .describe(
          'Path to write the PDF to. Defaults to the file name reported by the API.',
        ),
      preventSendBy: z
        .boolean()
        .default(false)
        .describe('Do not mark the order as sent by download.'),
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
    const pdf = await client.orders.getPdf({
      orderId,
      preventSendBy: options.preventSendBy,
    });
    const path = resolve(options.output ?? pdf.filename);
    await writeFile(path, Buffer.from(pdf.content, 'base64'));
    if (options.json) {
      printJson({ filename: pdf.filename, path });
      return;
    }
    consola.success(`Saved ${path}.`);
  },
});
