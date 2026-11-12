import type { Invoice } from '@mi-skam/sevdesk-sdk';
import { contactLabel } from '../output';

export function requireDraft(invoice: Invoice, sending = false) {
  if (invoice.sendDate || invoice.status !== '100' || invoice.enshrined) {
    throw new Error(
      sending
        ? 'Invoice is already sent or is not an editable draft; automatic resend is refused.'
        : 'Only unsent draft invoices can be changed or deleted. Finalised invoices are immutable (GoBD); use a credit note or cancellation instead.',
    );
  }
}
export function invoiceSummary(invoice: Invoice) {
  return `${invoice.invoiceNumber ?? invoice.id} (ID ${invoice.id}), contact ${contactLabel(invoice.contact) || invoice.contact?.id || 'not set'}, gross ${invoice.sumGross} ${invoice.currency}`;
}
