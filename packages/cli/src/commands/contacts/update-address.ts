import { consola } from 'consola';
import { z } from 'zod';
import { defineCommand, defineOptions } from 'zodline';
import { requireClient } from '../../client';
import { requireNumberOption } from '../../options';
import { printJson } from '../../output';

export default defineCommand({
  description: 'Update an address of a contact.',
  options: defineOptions(
    z.object({
      id: z.coerce
        .number()
        .optional()
        .describe(
          'The contact address ID, as shown by contacts:get. If omitted, you will be prompted.',
        ),
      street: z.string().optional().describe('Street and house number.'),
      zip: z.string().optional().describe('Zip code.'),
      city: z.string().optional().describe('City name.'),
      country: z.coerce
        .number()
        .optional()
        .describe(
          'ID of the country as a StaticCountry ID, for example 1 for Germany.',
        ),
      category: z.coerce
        .number()
        .optional()
        .describe('ID of the address category.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const fields = {
      street: options.street,
      zip: options.zip,
      city: options.city,
      countryId: options.country,
      categoryId: options.category,
    };
    if (Object.values(fields).every((value) => value === undefined)) {
      consola.error(
        'You must provide at least one of --street, --zip, --city, --country or --category.',
      );
      process.exit(1);
    }
    const client = await requireClient();
    const contactAddressId = await requireNumberOption({
      value: options.id,
      requirement: 'a contact address ID via --id',
      question: 'Enter the contact address ID:',
    });
    const address = await client.contactAddresses.update({
      contactAddressId,
      ...fields,
    });
    if (options.json) {
      printJson(address);
      return;
    }
    consola.success(`Updated contact address ${address.id}.`);
  },
});
