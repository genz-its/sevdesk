import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { z } from 'zod';
import { requireClient } from '../../client';
import { requireNumberOption } from '../../options';
import { printJson } from '../../output';

export default defineCommand({
  description: 'Update a contact.',
  options: defineOptions(
    z.object({
      id: z.coerce
        .number()
        .optional()
        .describe('The contact ID. If omitted, you will be prompted.'),
      name: z
        .string()
        .optional()
        .describe('Name of the organization. Not to be used for persons.'),
      surename: z
        .string()
        .optional()
        .describe(
          'First name of the person. Not to be used for organizations.',
        ),
      familyname: z
        .string()
        .optional()
        .describe('Last name of the person. Not to be used for organizations.'),
      category: z.coerce
        .number()
        .optional()
        .describe(
          'ID of the contact category: 2 supplier, 3 customer, 4 partner.',
        ),
      customerNumber: z
        .string()
        .optional()
        .describe('Customer number of the contact.'),
      description: z
        .string()
        .optional()
        .describe('Description of the contact.'),
      vatNumber: z.string().optional().describe('VAT number of the contact.'),
      taxNumber: z.string().optional().describe('Tax number of the contact.'),
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
    const contact = await client.contacts.update({
      contactId,
      categoryId: options.category,
      name: options.name,
      surename: options.surename,
      familyname: options.familyname,
      customerNumber: options.customerNumber,
      description: options.description,
      vatNumber: options.vatNumber,
      taxNumber: options.taxNumber,
    });
    if (options.json) {
      printJson(contact);
      return;
    }
    consola.success(`Updated contact ${contact.id}.`);
  },
});
