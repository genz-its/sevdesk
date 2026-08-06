import { consola } from 'consola';
import { z } from 'zod';
import { defineCommand, defineOptions } from 'zodline';
import { requireClient } from '../../client';
import { confirmOrAbort, requireNumberOption } from '../../options';
import { printJson } from '../../output';

export default defineCommand({
  description: 'Delete a tag.',
  options: defineOptions(
    z.object({
      id: z.coerce
        .number()
        .optional()
        .describe('The tag ID. If omitted, you will be prompted.'),
      yes: z.boolean().default(false).describe('Skip the confirmation prompt.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const tagId = await requireNumberOption({
      value: options.id,
      requirement: 'a tag ID via --id',
      question: 'Enter the tag ID:',
    });
    const confirmed = await confirmOrAbort({
      message: `Delete tag ${tagId}?`,
      yes: options.yes,
      initial: false,
    });
    if (!confirmed) {
      return;
    }
    await client.tags.delete({ tagId });
    if (options.json) {
      printJson({ deleted: true });
      return;
    }
    consola.success('Tag deleted.');
  },
});
