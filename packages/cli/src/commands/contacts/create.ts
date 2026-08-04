import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { z } from 'zod';
import { requireClient } from '../../client';
import { requireStringOption } from '../../options';
import { printJson } from '../../output';

export default defineCommand({
  description: 'Create a contact.',
  options: defineOptions(
    z.object({
      name: z
        .string()
        .optional()
        .describe(
          'Name of the organization. Not to be used for persons. If both --name and --familyname are omitted, you will be prompted for the organization name.',
        ),
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
        .default(3)
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
    const name =
      !options.name && !options.familyname
        ? await requireStringOption({
            value: undefined,
            requirement: 'a name via --name or --familyname',
            question: 'Enter the organization name:',
          })
        : options.name;
    const contact = await client.contacts.create({
      categoryId: options.category,
      name,
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
    consola.success(`Created contact ${contact.id}.`);
  },
});
