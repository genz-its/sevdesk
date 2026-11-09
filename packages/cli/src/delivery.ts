import { z } from 'zod';
export function html(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/\r?\n/g, '<br>');
}

const nonempty = z.string().trim().min(1);
export const deliverySchema = z.strictObject({
  to: z.email(),
  cc: z.array(z.email()).optional(),
  bcc: z.array(z.email()).optional(),
  subject: nonempty.refine(
    (v) => !/[\r\n]/.test(v),
    'Subject must be a single line.',
  ),
  message: nonempty,
  copyToSelf: z.boolean().optional(),
});
export type Delivery = z.infer<typeof deliverySchema>;

/** Shared quote/invoice email rendering; plain text input is escaped as HTML. */
export function emailBody(delivery: Delivery, number: string) {
  const substitute = (v: string) => v.replaceAll('{{number}}', number);
  return {
    toEmail: delivery.to,
    ccEmail: delivery.cc?.join(','),
    bccEmail: delivery.bcc?.join(','),
    subject: substitute(delivery.subject),
    text: html(substitute(delivery.message)),
    copy: delivery.copyToSelf,
  };
}
