import type {
  Contact,
  ContactAddress,
  SaveOrderOptions,
  SevDesk,
} from '@mi-skam/sevdesk-sdk';
import { randomUUID } from 'node:crypto';
import { mkdir, open, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { emailBody } from '../delivery';
import { assertNumberAvailable, nextNumber } from '../numbering';
import { fetchAll } from '../pagination';
import {
  deliverySchema,
  html,
  quoteAutoNumberSchema,
  quoteDraftSchema,
  quoteReadySchema,
  type Delivery,
  type QuoteDraft,
} from './model';

export async function loadQuote(path: string): Promise<QuoteDraft> {
  const handle = await open(path, 'r');
  try {
    const max = 1024 * 1024;
    const info = await handle.stat();
    if (!info.isFile() || info.size > max)
      throw new Error(
        'quote.json must be a regular file no larger than 1 MiB.',
      );
    const buffer = Buffer.alloc(max + 1);
    let size = 0;
    while (size < buffer.length) {
      const { bytesRead } = await handle.read(
        buffer,
        size,
        buffer.length - size,
        size,
      );
      if (!bytesRead) break;
      size += bytesRead;
    }
    if (size > max) throw new Error('quote.json exceeds 1 MiB.');
    return quoteDraftSchema.parse(
      JSON.parse(buffer.subarray(0, size).toString('utf8')),
    );
  } finally {
    await handle.close();
  }
}
export async function exportQuote(
  path: string,
  quote: QuoteDraft,
): Promise<void> {
  const content = JSON.stringify(quoteDraftSchema.parse(quote), null, 2) + '\n';
  if (Buffer.byteLength(content) > 1024 * 1024)
    throw new Error('Export exceeds the 1 MiB quote.json limit.');
  await writeFile(path, content, { flag: 'wx', mode: 0o600 });
}
export async function customers(client: SevDesk): Promise<Contact[]> {
  return fetchAll((page) =>
    client.contacts.list({ categoryId: 3, depth: '1', ...page }),
  );
}
export async function addresses(
  client: SevDesk,
  contactId: number,
): Promise<ContactAddress[]> {
  return fetchAll((page) => client.contactAddresses.list(page), {
    keep: (a) => a.contact.id === String(contactId),
  });
}
export function addressText(contact: Contact, address: ContactAddress): string {
  return [
    contact.name ||
      [contact.surename, contact.familyname].filter(Boolean).join(' '),
    address.street,
    [address.zip, address.city].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join('\n');
}

export async function numberQuote(
  client: SevDesk,
  draft: QuoteDraft,
): Promise<QuoteDraft> {
  const q = quoteAutoNumberSchema.parse(draft);
  if (!q.document.number)
    q.document.number = (await nextNumber(client, 'quote')).nextNumber;
  return quoteReadySchema.parse(q);
}

export async function resolveQuote(
  client: SevDesk,
  draft: QuoteDraft,
): Promise<{
  payload: SaveOrderOptions;
  customer: Contact;
  quote: QuoteDraft;
}> {
  const q = await numberQuote(client, draft);
  const selected = q.customer!;
  let contact: Contact;
  if ('id' in selected)
    contact = await client.contacts.get({ contactId: selected.id });
  else {
    const matches = (
      await fetchAll((page) =>
        client.contacts.list({
          customerNumber: selected.number,
          categoryId: 3,
          depth: '1',
          ...page,
        }),
      )
    ).filter(
      (c) => c.customerNumber === selected.number && c.status === '1000',
    );
    const topLevel = matches.filter((c) => !c.parent);
    const candidates = topLevel.length === 1 ? topLevel : matches;
    if (candidates.length !== 1)
      throw new Error(
        'Customer number (Kundennummer) is missing or ambiguous; use customer.id.',
      );
    contact = candidates[0]!;
  }
  if (contact.category.id !== '3' || contact.status !== '1000')
    throw new Error('Select an active customer (aktiver Kunde) before saving.');
  let recipient = q.recipient;
  if (!recipient) {
    const choices = (await addresses(client, Number(contact.id))).filter(
      (a) => a.street?.trim() && a.zip?.trim() && a.city?.trim(),
    );
    if (choices.length !== 1)
      throw new Error(
        'Select one complete recipient address (Empfängeradresse) or supply recipient.address and recipient.countryId.',
      );
    recipient = {
      address: addressText(contact, choices[0]!),
      countryId: Number(choices[0]!.country.id),
    };
  }
  const date = (v: string) => v.split('-').reverse().join('.');
  const closing = [
    q.texts.closing,
    q.document.validUntil
      ? `Gültig bis: ${date(q.document.validUntil)}`
      : undefined,
  ]
    .filter(Boolean)
    .join('\n\n');
  return {
    customer: contact,
    quote: q,
    payload: {
      order: {
        orderNumber: q.document.number!,
        orderDate: date(q.document.date!),
        contactId: Number(contact.id),
        status: 100,
        orderType: 'AN',
        header: q.document.heading!,
        version: 0,
        addressCountryId: recipient.countryId,
        address: recipient.address,
        contactPersonId: q.document.contactPersonId!,
        taxRuleId: q.tax.ruleId!,
        taxRate: 0,
        taxText: q.tax.text!,
        currency: q.document.currency!,
        showNet: q.document.priceMode === 'net',
        smallSettlement: q.document.smallSettlement,
        headText:
          q.texts.introduction === undefined
            ? undefined
            : html(q.texts.introduction),
        footText: closing ? html(closing) : undefined,
        paymentTerms:
          q.terms.payment === undefined ? undefined : html(q.terms.payment),
        deliveryTerms:
          q.terms.delivery === undefined ? undefined : html(q.terms.delivery),
        customerInternalNote: q.document.customerReference,
      },
      positions: q.positions.map((p, positionNumber) => ({
        name: p.name,
        text: p.description === undefined ? undefined : html(p.description),
        quantity: Number(p.quantity),
        price: Number(p.unitPrice),
        taxRate: Number(p.vatRate),
        unityId: p.unit.id,
        discount: p.discount === undefined ? undefined : Number(p.discount),
        optional: p.optional,
        positionNumber,
      })),
    },
  };
}

type State =
  | 'creating'
  | 'creation-unknown'
  | 'saved'
  | 'sending'
  | 'sent'
  | 'send-unknown'
  | 'already-sent';
export interface OperationResult {
  state: State;
  receipt: string;
  draftFile?: string;
  orderId?: string;
  orderNumber?: string;
  message?: string;
  status?: string;
  totals?: { net: string; vat: string; gross: string };
}
class Receipt {
  private constructor(readonly path: string) {}
  static async reserve(path?: string) {
    const target = resolve(
      path ??
        join(
          process.env['XDG_STATE_HOME'] || join(homedir(), '.local/state'),
          'sevdesk',
          'quotes',
          `${randomUUID()}.json`,
        ),
    );
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(target, JSON.stringify({ state: 'reserved' }) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
    return new Receipt(target);
  }
  async update(result: OperationResult) {
    const temp = `${this.path}.${randomUUID()}.tmp`;
    try {
      await writeFile(temp, JSON.stringify(result, null, 2) + '\n', {
        flag: 'wx',
        mode: 0o600,
      });
      await rename(temp, this.path);
    } catch {
      throw new Error(
        `Could not update operation receipt ${this.path}. Last known state: ${result.state}; quote ID: ${result.orderId ?? 'unknown'}; number: ${result.orderNumber ?? 'unknown'}. Inspect sevdesk before retrying.`,
      );
    }
  }
}

/** Every POST is issued once. A receipt survives unknown outcomes and discourages blind retries. */
export async function createQuote(
  client: SevDesk,
  draft: QuoteDraft,
  send: boolean,
  receiptPath?: string,
): Promise<OperationResult> {
  const delivery = send ? deliverySchema.parse(draft.delivery) : undefined;
  const { payload, quote } = await resolveQuote(client, draft);
  await assertNumberAvailable(client, 'quote', payload.order.orderNumber);
  const receipt = await Receipt.reserve(receiptPath);
  const draftFile = `${receipt.path}.quote.json`;
  await exportQuote(draftFile, quote);
  let result: OperationResult = {
    state: 'creating',
    receipt: receipt.path,
    draftFile,
    orderNumber: payload.order.orderNumber,
  };
  await receipt.update(result);
  let saved;
  try {
    saved = await client.orders.save(payload);
    if (!saved?.order?.id || !/^\d+$/.test(saved.order.id))
      throw new Error('Missing saved quote acknowledgement.');
  } catch {
    result = {
      ...result,
      state: 'creation-unknown',
      message:
        'Creation failed or its outcome is unknown. Check sevdesk and this receipt before retrying; no automatic retry was made.',
    };
    await receipt.update(result);
    return result;
  }
  result = {
    ...result,
    state: 'saved',
    orderId: saved.order.id,
    orderNumber: saved.order.orderNumber,
    status: saved.order.status,
    totals: {
      net: saved.order.sumNet,
      vat: saved.order.sumTax,
      gross: saved.order.sumGross,
    },
  };
  await receipt.update(result);
  if (saved.order.status !== '100' || saved.order.orderType !== 'AN') {
    result = {
      ...result,
      state: 'send-unknown',
      message:
        'Unexpected saved document state; not sent. Inspect the saved document.',
    };
    await receipt.update(result);
    return result;
  }
  return delivery ? deliver(client, receipt, result, delivery) : result;
}

export async function sendQuote(
  client: SevDesk,
  orderId: number,
  delivery: Delivery,
  receiptPath?: string,
): Promise<OperationResult> {
  const checked = deliverySchema.parse(delivery);
  const order = await client.orders.get({ orderId });
  if (order.orderType !== 'AN')
    throw new Error('Only quotes (Angebote) can be sent by this command.');
  if (order.sendDate || order.status !== '100')
    throw new Error(
      'Quote is already sent or is not a draft. Inspect its sending status (Versandstatus); automatic resend is refused.',
    );
  const receipt = await Receipt.reserve(receiptPath);
  return deliver(
    client,
    receipt,
    {
      state: 'saved',
      receipt: receipt.path,
      orderId: order.id,
      orderNumber: order.orderNumber,
    },
    checked,
  );
}

async function deliver(
  client: SevDesk,
  receipt: Receipt,
  current: OperationResult,
  delivery: Delivery,
): Promise<OperationResult> {
  const result = { ...current, state: 'sending' as State };
  await receipt.update(result);
  const number = current.orderNumber || current.orderId!;
  try {
    const mails = await client.orders.sendViaEmail({
      orderId: Number(current.orderId),
      ...emailBody(delivery, number),
    });
    if (!Array.isArray(mails) || mails.length === 0)
      throw new Error('Missing send acknowledgement');
    const sent: OperationResult = {
      ...result,
      state: 'sent',
      message:
        'Sending accepted by sevdesk (Versand angenommen); inbox delivery is not verified.',
    };
    await receipt.update(sent);
    return sent;
  } catch {
    let status: string | undefined;
    let sendDate: string | null | undefined;
    try {
      const order = await client.orders.get({
        orderId: Number(current.orderId),
      });
      status = order.status;
      sendDate = order.sendDate;
    } catch {
      /* Preserve unknown outcome. */
    }
    const failed: OperationResult = {
      ...result,
      state: 'send-unknown',
      status,
      message: `Quote saved (Angebot gespeichert), but sending failed or is unconfirmed (Versand fehlgeschlagen/unklar). ${sendDate ? 'sevdesk has a send date; do not resend.' : 'Check sending status before using quotes:send with the saved order ID. Do not rerun quotes:create.'}`,
    };
    await receipt.update(failed);
    return failed;
  }
}

export function operationSucceeded(result: OperationResult) {
  return result.state === 'saved' || result.state === 'sent';
}
