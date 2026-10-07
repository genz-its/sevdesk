import { consola } from 'consola';
import { writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { z } from 'zod';
import { defineCommand, defineOptions } from 'zodline';
import { requireClient } from '../../client';
import { requireNumberOption } from '../../options';
import { printJson } from '../../output';

export default defineCommand({
  description: 'Download the document attached to a voucher.',
  options: defineOptions(
    z.object({
      id: z.coerce
        .number()
        .optional()
        .describe('ID of the voucher. If omitted, you will be prompted.'),
      output: z
        .string()
        .optional()
        .describe(
          'Path to write the document to. Defaults to the file name reported by the API. Existing files are never overwritten.',
        ),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const voucherId = await requireNumberOption({
      value: options.id,
      requirement: 'a voucher ID via --id',
      question: 'Enter the voucher ID:',
    });
    const voucher = await client.vouchers.get({ voucherId });
    if (!voucher.document) {
      consola.error(`Voucher ${voucherId} has no document attached.`);
      process.exit(1);
    }
    const file = await client.documents.download({
      documentId: Number(voucher.document.id),
    });
    // basename() keeps a reported name like `../x.pdf` inside the working directory.
    const filename = file.filename
      ? basename(file.filename)
      : `voucher-${voucherId}.${file.mimeType.split('/')[1]}`;
    const path = resolve(options.output ?? filename);
    // Decode unless explicitly flagged as raw: the flag's spelling is unverified.
    const content =
      file.base64Encoded === false
        ? file.content
        : Buffer.from(file.content, 'base64');
    await writeFile(path, content, { flag: 'wx' });
    if (options.json) {
      printJson({ filename, path });
      return;
    }
    consola.success(`Saved ${path}.`);
  },
});
