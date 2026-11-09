import { consola } from 'consola';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { defineCommand, defineOptions } from 'zodline';
import { idArgument } from '../../arguments';
import { requireClient } from '../../client';
import { deliverySchema, emailBody } from '../../delivery';
import { reserveSendReceipt } from '../../invoices/receipt';
import { invoiceSummary, requireDraft } from '../../invoices/workflow';
import { confirmOrAbort } from '../../options';
import { printJson } from '../../output';

export default defineCommand({
  description: 'Email and finalise an unsent invoice draft. Never resends.',
  args: z.tuple([
    idArgument.describe('Invoice ID.'),
    z.string().min(1).describe('delivery.json'),
  ]),
  options: defineOptions(
    z.object({
      dryRun: z
        .boolean()
        .default(false)
        .describe('Validate email input offline; no network calls.'),
      yes: z
        .boolean()
        .default(false)
        .describe('Confirm recipient and finalisation.'),
      receipt: z
        .string()
        .optional()
        .describe('New operation receipt path (Vorgangsprotokoll).'),
      json: z.boolean().default(false).describe('Output in JSON format.'),
    }),
  ),
  action: async (options, [invoiceId, file]) => {
    const { delivery } = z
      .object({ delivery: deliverySchema })
      .parse(JSON.parse(await readFile(file, 'utf8')));
    if (options.dryRun) {
      printJson({
        dryRun: true,
        invoiceId,
        delivery,
        attachment: 'Invoice PDF',
        accountValidated: false,
        note: '{{number}} is resolved from the stored invoice only when sending online.',
      });
      return;
    }
    const client = await requireClient();
    const invoice = await client.invoices.get({
      invoiceId,
      embed: ['contact'],
    });
    requireDraft(invoice, true);
    if (
      !(await confirmOrAbort({
        message: `Email and finalise draft ${invoiceSummary(invoice)} to ${delivery.to}${delivery.cc?.length ? `; cc ${delivery.cc.join(', ')}` : ''}${delivery.bcc?.length ? `; bcc ${delivery.bcc.join(', ')}` : ''}?`,
        yes: options.yes,
        initial: false,
      }))
    )
      return;
    const receipt = await reserveSendReceipt(options.receipt);
    const current = {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      sendType: invoice.sendType,
      sendDate: invoice.sendDate,
      receipt: receipt.path,
    };
    await receipt.update({ ...current, state: 'sending' });
    let result;
    try {
      const email = await client.invoices.sendViaEmail({
        invoiceId,
        ...emailBody(delivery, invoice.invoiceNumber ?? invoice.id),
      });
      const sent = email?.object;
      if (
        email?.objectName !== 'Email' ||
        sent?.id !== invoice.id ||
        sent.status !== '200' ||
        !sent.sendDate ||
        sent.sendType !== 'VM'
      )
        throw new Error('Missing send acknowledgement.');
      result = {
        ...current,
        state: 'sent',
        invoiceNumber: sent.invoiceNumber,
        status: sent.status,
        sendType: sent.sendType,
        sendDate: sent.sendDate,
        email,
        message: 'Sending accepted by sevdesk; inbox delivery is not verified.',
      };
    } catch {
      let stored;
      try {
        stored = await client.invoices.get({ invoiceId });
      } catch {
        /* Outcome remains unknown. */
      }
      result = {
        ...current,
        state: 'send-unknown',
        status: stored?.status ?? current.status,
        sendType: stored?.sendType ?? current.sendType,
        sendDate: stored?.sendDate ?? current.sendDate,
        message:
          'Sending failed or its outcome is unknown. No automatic retry was made. Inspect sevdesk and the receipt before retrying; never resend an invoice with a send date.',
      };
      process.exitCode = 1;
    }
    await receipt.update(result);
    if (options.json) printJson(result);
    else consola.info(JSON.stringify(result, null, 2));
  },
});
