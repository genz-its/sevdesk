import type { Contact } from '@genz-its/sevdesk-sdk';
import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { z } from 'zod';
import { requireClient } from '../../client';
import { printJson, printTable } from '../../output';
import { fetchAll } from '../../pagination';

export default defineCommand({
  description: 'List contacts.',
  options: defineOptions(
    z.object({
      name: z
        .string()
        .optional()
        .describe('Filter by organization, first or last name.'),
      customerNumber: z
        .string()
        .optional()
        .describe('Filter by customer number.'),
      depth: z.coerce
        .number()
        .optional()
        .describe(
          'Contact depth: 0 returns only organizations, 1 organizations and persons. Defaults to 0.',
        ),
      category: z.coerce
        .number()
        .optional()
        .describe(
          'ID of the contact category to filter by: 2 supplier, 3 customer, 4 partner.',
        ),
      limit: z.coerce
        .number()
        .optional()
        .describe(
          'Maximum number of contacts to return. Defaults to all of them.',
        ),
      offset: z.coerce
        .number()
        .optional()
        .describe('Number of contacts to skip.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const contacts = await fetchAll(
      (page) =>
        client.contacts.list({
          name: options.name,
          customerNumber: options.customerNumber,
          depth: toDepth(options.depth),
          categoryId: options.category,
          ...page,
        }),
      { limit: options.limit, offset: options.offset },
    );
    if (options.json) {
      printJson(contacts);
      return;
    }
    if (contacts.length === 0) {
      consola.info('No contacts found.');
      return;
    }
    printTable(
      contacts.map((contact) => ({
        id: contact.id,
        number: contact.customerNumber ?? '',
        name: formatContactName(contact),
        status: contact.status ?? '',
        category: contact.category.id,
      })),
    );
  },
});

function toDepth(depth: number | undefined): '0' | '1' | undefined {
  if (depth === undefined) {
    return undefined;
  }
  return depth === 0 ? '0' : '1';
}

function formatContactName(contact: Contact): string {
  return (
    contact.name ??
    [contact.surename, contact.familyname].filter(Boolean).join(' ')
  );
}
