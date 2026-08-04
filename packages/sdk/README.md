# @genz-its/sevdesk-sdk

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

```bash
npm install @genz-its/sevdesk-sdk
```

## Usage

```ts
import { readFile } from 'node:fs/promises';
import { SevDesk } from '@genz-its/sevdesk-sdk';

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

// Book the voucher against a transaction
await sevdesk.vouchers.book({
  voucherId: Number(voucher.id),
  amount: 119,
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
| `userAgent` | The `User-Agent` header value.                                        | `@genz-its/sevdesk-sdk`        |
| `fetch`     | A custom `fetch` implementation, for example for testing or proxying. | `globalThis.fetch`             |

### Resources

| Resource                  | Description                                                          |
| ------------------------- | -------------------------------------------------------------------- |
| `sevdesk.basics`          | Detect the bookkeeping system version of the account.                |
| `sevdesk.checkAccounts`   | Manage check accounts and query balances.                            |
| `sevdesk.contacts`        | Manage contacts and customer numbers.                                |
| `sevdesk.creditNotes`     | Manage credit notes, send them, and book payments.                   |
| `sevdesk.exports`         | Run DATEV export jobs and CSV exports.                               |
| `sevdesk.invoices`        | Manage invoices, render PDFs, send them, and book payments.          |
| `sevdesk.orders`          | Manage orders and their positions.                                   |
| `sevdesk.parts`           | Manage parts and query stock.                                        |
| `sevdesk.receiptGuidance` | Find bookable accounts (`AccountDatev`) and their allowed tax rules. |
| `sevdesk.reports`         | Generate PDF reports.                                                |
| `sevdesk.tags`            | Manage tags and tag relations.                                       |
| `sevdesk.transactions`    | Manage check account transactions.                                   |
| `sevdesk.vouchers`        | Upload receipts, create and book vouchers.                           |

### Error handling

Any non-2xx response throws a `SevDeskError` with the HTTP `status`, `statusText`, the parsed response `body`, and a `message` extracted from the API error payload:

```ts
import { SevDeskError } from '@genz-its/sevdesk-sdk';

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

[MIT](../../LICENSE)

[^1]: This project is not affiliated with, endorsed by, sponsored by, or approved by sevDesk GmbH or any of their affiliates or subsidiaries.
