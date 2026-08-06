import { consola } from 'consola';
import { z } from 'zod';
import { defineCommand, defineOptions } from 'zodline';
import { requireClient } from '../../client';
import { requireNumberOption, requireStringOption } from '../../options';
import { printJson } from '../../output';

export default defineCommand({
  description: 'Add an e-mail address to a contact.',
  options: defineOptions(
    z.object({
      contact: z.coerce
        .number()
        .optional()
        .describe('The contact ID. If omitted, you will be prompted.'),
      email: z
        .string()
        .optional()
        .describe('The e-mail address. If omitted, you will be prompted.'),
      key: z.coerce
        .number()
        .default(2)
        .describe(
          'ID of the communication way key: 1 private, 2 work, 7 newsletter, 8 invoicing.',
        ),
      main: z
        .boolean()
        .default(false)
        .describe('Mark the e-mail address as the main one of the contact.'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options) => {
    const client = await requireClient();
    const contactId = await requireNumberOption({
      value: options.contact,
      requirement: 'a contact ID via --contact',
      question: 'Enter the contact ID:',
    });
    const email = await requireStringOption({
      value: options.email,
      requirement: 'an e-mail address via --email',
      question: 'Enter the e-mail address:',
    });
    if (!email.includes('@')) {
      consola.error('The e-mail address must contain an "@".');
      process.exit(1);
    }
    const communicationWay = await client.communicationWays.create({
      contactId,
      type: 'EMAIL',
      value: email,
      keyId: options.key,
      main: options.main,
    });
    if (options.json) {
      printJson(communicationWay);
      return;
    }
    consola.success(`Created e-mail communication way ${communicationWay.id}.`);
  },
});
