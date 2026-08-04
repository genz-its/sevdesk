import type { TagObjectType } from '@genz-its/sevdesk-sdk';
import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { z } from 'zod';
import { requireClient } from '../../client';
import { requireNumberOption, requireStringOption } from '../../options';
import { printJson } from '../../output';

const OBJECT_TYPES = ['Invoice', 'Voucher', 'Order', 'CreditNote'] as const;

export default defineCommand({
  description: 'Create a tag and attach it to a document.',
  options: defineOptions(
    z.object({
      name: z
        .string()
        .optional()
        .describe('Name of the tag. If omitted, you will be prompted.'),
      objectType: z
        .string()
        .optional()
        .describe(
          'Type of the document to tag: Invoice, Voucher, Order or CreditNote. If omitted, you will be prompted.',
        ),
      objectId: z.coerce
        .number()
        .optional()
        .describe(
          'ID of the document to tag. If omitted, you will be prompted.',
        ),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const name = await requireStringOption({
      value: options.name,
      requirement: 'a tag name via --name',
      question: 'Enter the tag name:',
    });
    const objectType = await requireStringOption({
      value: options.objectType,
      requirement: 'a document type via --object-type',
      question: `Enter the document type (${OBJECT_TYPES.join(', ')}):`,
    });
    if (!isTagObjectType(objectType)) {
      consola.error(
        `The document type must be one of: ${OBJECT_TYPES.join(', ')}.`,
      );
      process.exit(1);
    }
    const objectId = await requireNumberOption({
      value: options.objectId,
      requirement: 'a document ID via --object-id',
      question: 'Enter the document ID:',
    });
    const relation = await client.tags.create({
      name,
      objectId,
      objectName: objectType,
    });
    if (options.json) {
      printJson(relation);
      return;
    }
    consola.success(`Created tag ${relation.tag.id}.`);
  },
});

function isTagObjectType(value: string): value is TagObjectType {
  return OBJECT_TYPES.some((objectType) => objectType === value);
}
