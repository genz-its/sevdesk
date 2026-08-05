import type { CommunicationWay, ContactAddress } from '@genz-its/sevdesk-sdk';
import { defineCommand, defineOptions } from '@robingenz/zli';
import { consola } from 'consola';
import { z } from 'zod';
import { requireClient } from '../../client';
import { requireNumberOption } from '../../options';
import { printJson } from '../../output';
import { fetchAll } from '../../pagination';

export default defineCommand({
  description:
    'Show a single contact with its addresses and communication ways.',
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
    /** The `/ContactAddress` endpoint cannot filter by contact, so we filter here. */
    const addresses = await fetchAll(
      (page) => client.contactAddresses.list(page),
      { keep: (address) => address.contact.id === String(contactId) },
    );
    const communicationWays = await fetchAll((page) =>
      client.communicationWays.list({ contactId, ...page }),
    );
    if (options.json) {
      printJson({ contact, addresses, communicationWays });
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
    printSection('Addresses:', addresses.map(formatAddress));
    printSection(
      'Communication ways:',
      communicationWays.map(formatCommunicationWay),
    );
  },
});

function printSection(title: string, lines: string[]): void {
  consola.info(title);
  for (const line of lines.length === 0 ? ['-'] : lines) {
    consola.info(`  ${line}`);
  }
}

function formatAddress(address: ContactAddress): string {
  const parts = [
    address.street,
    [address.zip, address.city].filter((part) => part).join(' '),
    `country ${address.country.id}`,
  ];
  return parts.filter((part) => part).join(', ');
}

function formatCommunicationWay(communicationWay: CommunicationWay): string {
  const main = communicationWay.main === '1' ? ' (main)' : '';
  return `${communicationWay.type}: ${communicationWay.value}${main}`;
}
