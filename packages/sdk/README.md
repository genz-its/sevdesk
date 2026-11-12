# @mi-skam/sevdesk-sdk

Unofficial Node.js SDK for the [sevdesk](https://sevdesk.de/) API.[^1]

## Features

- 🧩 **Complete resource coverage**: Vouchers, transactions, check accounts, contacts, invoices, credit notes, orders, parts, tags, exports, reports and receipt guidance.
- 🪶 **Zero dependencies**: Built on the native `fetch` API.
- 🔁 **Resilient**: Automatic retries with exponential backoff for network errors, `429` and `5xx` responses on idempotent requests.
- 🦺 **Fully typed**: Hand-written TypeScript types that reflect the actual API behavior, including the quirks the OpenAPI specification gets wrong.
- 🇩🇪 **sevdesk-Update 2.0**: Built for bookkeeping system version 2.0 (`taxRule`, `accountDatev`).

## Requirements

- Node.js 22 or later.
- A sevdesk account on bookkeeping system version 2.0 (sevdesk-Update 2.0).

## Installation

Download `sevdesk-sdk-X.Y.Z.tgz` from the [latest GitHub release](https://github.com/mi-skam/sevdesk/releases/latest), then:

```bash
npm install ./sevdesk-sdk-X.Y.Z.tgz
```

The package is not published to npm; the `@genz-its/sevdesk-sdk` package on npm is
the upstream distribution.

## Usage

```ts
import { readFile } from 'node:fs/promises';
import { SevDesk } from '@mi-skam/sevdesk-sdk';

const sevdesk = new SevDesk({ token: process.env.SEVDESK_TOKEN! });

// Upload a receipt and create an open voucher in one call
const { voucher } = await sevdesk.vouchers.createFromFile({
  file: await readFile('receipt.pdf'),
  filename: 'receipt.pdf',
  voucher: {
    status: 100,
    creditDebit: 'C',
    taxRuleId: 9,
    supplierName: 'ACME GmbH',
    voucherDate: new Date(),
  },
  positions: [{ accountDatevId: 26, taxRate: 19, net: false, sumGross: 119 }],
});

// Find unbooked bank transactions
const transactions = await sevdesk.transactions.list({ isBooked: false });

// Book the voucher against a transaction. The amount flows over the check
// account, so it is negative for expense vouchers.
await sevdesk.vouchers.book({
  voucherId: Number(voucher.id),
  amount: -119,
  date: new Date(),
  type: 'FULL_PAYMENT',
  checkAccountId: 1,
  checkAccountTransactionId: Number(transactions[0].id),
});
```

### Client options

| Option      | Description                                                           | Default                        |
| ----------- | --------------------------------------------------------------------- | ------------------------------ |
| `token`     | The sevdesk API token, sent as raw `Authorization` header value.      | –                              |
| `baseUrl`   | The API base URL.                                                     | `https://my.sevdesk.de/api/v1` |
| `timeout`   | Request timeout in milliseconds.                                      | `30000`                        |
| `userAgent` | The `User-Agent` header value.                                        | `@mi-skam/sevdesk-sdk`         |
| `fetch`     | A custom `fetch` implementation, for example for testing or proxying. | `globalThis.fetch`             |

### Resources

| Resource                    | Description                                                                                                         |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `sevdesk.basics`            | Detect the bookkeeping system version and read numbering configuration.                                             |
| `sevdesk.checkAccounts`     | Manage check accounts and query balances.                                                                           |
| `sevdesk.contacts`          | Manage contacts and customer numbers.                                                                               |
| `sevdesk.contactAddresses`  | Manage the addresses of contacts.                                                                                   |
| `sevdesk.communicationWays` | Manage the phone numbers and e-mail addresses of contacts.                                                          |
| `sevdesk.creditNotes`       | Manage credit notes, send them, and book payments.                                                                  |
| `sevdesk.documents`         | Download the files attached to vouchers.                                                                            |
| `sevdesk.exports`           | Run DATEV export jobs and CSV exports.                                                                              |
| `sevdesk.invoices`          | Create/partially update drafts (`save`), delete (`delete`), email (`sendViaEmail`), render PDFs, and book payments. |
| `sevdesk.orders`            | Manage orders and their positions.                                                                                  |
| `sevdesk.parts`             | Manage parts and query stock.                                                                                       |
| `sevdesk.receiptGuidance`   | Find bookable accounts (`AccountDatev`) and their allowed tax rules.                                                |
| `sevdesk.reports`           | Generate PDF reports.                                                                                               |
| `sevdesk.tags`              | Manage tags and tag relations.                                                                                      |
| `sevdesk.transactions`      | Manage check account transactions.                                                                                  |
| `sevdesk.vouchers`          | Upload receipts, create and book vouchers.                                                                          |

### Invoice draft workflows

`invoices.save` creates drafts with `invoice: InvoiceInput`, or partially updates
an existing invoice with `invoice: { id, ...changedFields }`. It injects
`objectName: 'Invoice'` and `mapAll: true`; omitted fields on updates are not
defaulted or reset. Both modes use `POST /Invoice/Factory/saveInvoice`.

```ts
await sevdesk.invoices.save({
  invoice: { id: 9001, contactId: 1001, headText: '<p>Dear ACME,</p>' },
  takeDefaultAddress: true,
});
```

Omit `invoicePosSave` to leave positions unchanged. To replace them, retrieve
all old positions (paginate `listPositions`), supply new `invoicePosSave` values
and `invoicePosDelete: [{ id: 7001, objectName: 'InvoicePos' }]`. The existing
`positions` option remains an alias for `invoicePosSave`; do not pass both.
`invoicePosDelete` defaults to `null`. Saving returns `{ invoice, positions }`.

`listPositions({ invoiceId, limit?, offset?, embed? })` uses `GET /InvoicePos`
with an invoice filter. Use it for paginated reads: the convenience
`GET /Invoice/{invoiceId}/getPositions` endpoint can ignore `offset` and repeat
its first page. The SDK's `getPositions` stays a 1:1 wrapper for that endpoint.

`invoices.sendViaEmail({ invoiceId, toEmail, subject, text, ... })` posts to
`/Invoice/{invoiceId}/sendViaEmail`, returning the unwrapped `InvoiceEmail`
object whose `object` is the invoice. Optional fields are `ccEmail`, `bccEmail`,
`copy`, `additionalAttachments`, and `sendXml`. Sending finalises the invoice.
`invoices.delete({ invoiceId })` uses `DELETE /Invoice/{invoiceId}` and returns
nothing. The SDK is endpoint-level: callers must check draft/sending state and
obtain approval before modifying, finalising, or deleting live invoices.
The CLI provides these guards. Never blindly retry a failed send or save.

### Error handling

Any non-2xx response throws a `SevDeskError` with the HTTP `status`, `statusText`, the parsed response `body`, and a `message` extracted from the API error payload:

```ts
import { SevDeskError } from '@mi-skam/sevdesk-sdk';

try {
  await sevdesk.vouchers.get({ voucherId: 123 });
} catch (error) {
  if (error instanceof SevDeskError) {
    console.error(error.status, error.message);
  }
}
```

### Good to know

- The sevdesk API returns **all scalar values in responses as strings**, including IDs and amounts. The response types reflect that faithfully.
- Date fields accept `Date` objects, Unix timestamps or strings and are serialized per endpoint to what the API expects (`dd.mm.yyyy`/timestamp for vouchers, ISO 8601 for transactions).
- Use `sevdesk.basics.getBookkeepingSystemVersion()` to verify an account runs on version `2.0` — the SDK does not support the legacy 1.0 payload shapes (`taxType`, `accountingType`).

## License

See [LICENSE](https://github.com/mi-skam/sevdesk/blob/main/LICENSE).

[^1]: This project is not affiliated with, endorsed by, sponsored by, or approved by sevDesk GmbH or any of their affiliates or subsidiaries.
