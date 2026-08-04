import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { z } from 'zod';
import { requireClient } from '../../client';
import { requireNumberOption } from '../../options';
import { printJson } from '../../output';

export default defineCommand({
  description: 'Show a single contact.',
  options: defineOptions(
    z.object({
      id: z.coerce
        .number()
        .optional()
        .describe('The contact ID. If omitted, you will be prompted.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const contactId = await requireNumberOption({
      value: options.id,
      requirement: 'a contact ID via --id',
      question: 'Enter the contact ID:',
    });
    const contact = await client.contacts.get({ contactId });
    if (options.json) {
      printJson(contact);
      return;
    }
    consola.info(`ID: ${contact.id}`);
    consola.info(`Name: ${contact.name ?? '-'}`);
    consola.info(`First name: ${contact.surename ?? '-'}`);
    consola.info(`Last name: ${contact.familyname ?? '-'}`);
    consola.info(`Customer number: ${contact.customerNumber ?? '-'}`);
    consola.info(`Category: ${contact.category.id}`);
    consola.info(`Status: ${contact.status ?? '-'}`);
    consola.info(`Description: ${contact.description ?? '-'}`);
    consola.info(`VAT number: ${contact.vatNumber ?? '-'}`);
    consola.info(`Tax number: ${contact.taxNumber ?? '-'}`);
  },
});
