# @genz-its/sevdesk-cli

Unofficial command-line interface for the [sevdesk](https://sevdesk.de/) API.[^1]

## Features

- 🧾 **Vouchers**: Create vouchers from receipt files (PDF, image, XML), list, book, reset and enshrine them.
- 💳 **Transactions**: List and filter bank transactions, for example the ones that are not booked yet.
- 🏦 **Check accounts**: List accounts, query balances, and create clearing or file import accounts.
- 🧭 **Receipt guidance**: Find bookable accounts and their allowed tax rules.
- 📄 **Documents**: List invoices, credit notes and orders, and download them as PDF.
- 📤 **Exports**: Export accounting data in the DATEV format, or contacts, invoices, transactions and vouchers as CSV.
- 🤖 **Automation-friendly**: `--json` output on every command, non-interactive mode, and stable exit codes.

## Requirements

- Node.js 22 or later.
- A sevdesk account on bookkeeping system version 2.0 (sevdesk-Update 2.0).

## Installation

Install the CLI globally:

```bash
npm install -g @genz-its/sevdesk-cli
```

Alternatively, run it without installation:

```bash
npx @genz-its/sevdesk-cli <command>
```

## Quickstart

```bash
# Log in with your sevdesk API token
sevdesk login

# Verify your setup
sevdesk doctor

# Find a booking account and its allowed tax rules
sevdesk guidance:accounts --expense

# Create an open voucher from a receipt file
sevdesk vouchers:create --file receipt.pdf --supplier-name "ACME GmbH" --amount 119 --tax-rule 9 --account-datev 26

# List unbooked bank transactions
sevdesk transactions:list --unbooked

# Book the voucher against a bank transaction
sevdesk vouchers:book --id 123 --amount 119 --check-account 1 --transaction 456
```

## Authentication

Run [`sevdesk login`](#login) to validate and store your API token. You can find the token in your sevdesk account under **Settings > User > API token**.

The token is resolved in the following order:

1. The `SEVDESK_TOKEN` environment variable.
2. The config file written by `sevdesk login` (`~/.config/sevdesk/config.json`, respecting `XDG_CONFIG_HOME`).

In CI or other automated environments, prefer the `SEVDESK_TOKEN` environment variable over storing the token on disk.

## Scripting

The CLI is designed to be scriptable:

- **`--json`**: Every command supports the `--json` flag to output machine-readable JSON.
- **Non-interactive mode**: When the CLI runs without a TTY or with the `CI` environment variable set, it never prompts. Missing required values cause an error and exit code `1` instead.
- **`--yes`**: Commands that ask for confirmation accept `--yes` to skip the prompt.
- **Exit codes**: `0` on success, `1` on any failure.

```bash
# Example: print the IDs of all unbooked transactions
sevdesk transactions:list --unbooked --json | jq -r '.[].id'
```

## Commands

- [`login`](#login)
- [`logout`](#logout)
- [`doctor`](#doctor)
- [`accounts-datev:get`](#accounts-datevget)
- [`accounts-datev:list`](#accounts-datevlist)
- [`accounts:balance`](#accountsbalance)
- [`accounts:create-clearing`](#accountscreate-clearing)
- [`accounts:create-file-import`](#accountscreate-file-import)
- [`accounts:get`](#accountsget)
- [`accounts:list`](#accountslist)
- [`contacts:add-address`](#contactsadd-address)
- [`contacts:add-email`](#contactsadd-email)
- [`contacts:add-phone`](#contactsadd-phone)
- [`contacts:create`](#contactscreate)
- [`contacts:delete`](#contactsdelete)
- [`contacts:delete-address`](#contactsdelete-address)
- [`contacts:get`](#contactsget)
- [`contacts:list`](#contactslist)
- [`contacts:update`](#contactsupdate)
- [`contacts:update-address`](#contactsupdate-address)
- [`credit-notes:get`](#credit-notesget)
- [`credit-notes:list`](#credit-noteslist)
- [`credit-notes:pdf`](#credit-notespdf)
- [`export:contacts`](#exportcontacts)
- [`export:datev`](#exportdatev)
- [`export:invoices`](#exportinvoices)
- [`export:transactions`](#exporttransactions)
- [`export:vouchers`](#exportvouchers)
- [`guidance:accounts`](#guidanceaccounts)
- [`invoices:get`](#invoicesget)
- [`invoices:list`](#invoiceslist)
- [`invoices:pdf`](#invoicespdf)
- [`orders:get`](#ordersget)
- [`orders:list`](#orderslist)
- [`orders:pdf`](#orderspdf)
- [`parts:get`](#partsget)
- [`parts:list`](#partslist)
- [`tags:create`](#tagscreate)
- [`tags:delete`](#tagsdelete)
- [`tags:list`](#tagslist)
- [`transactions:create`](#transactionscreate)
- [`transactions:get`](#transactionsget)
- [`transactions:list`](#transactionslist)
- [`vouchers:book`](#vouchersbook)
- [`vouchers:create`](#voucherscreate)
- [`vouchers:enshrine`](#vouchersenshrine)
- [`vouchers:get`](#vouchersget)
- [`vouchers:list`](#voucherslist)
- [`vouchers:positions`](#voucherspositions)
- [`vouchers:reset-to-draft`](#vouchersreset-to-draft)
- [`vouchers:reset-to-open`](#vouchersreset-to-open)

### `login`

Log in with your sevdesk API token. The token is validated against the sevdesk API and stored in the config file. Accounts on bookkeeping system version 1.0 are rejected.

```bash
sevdesk login [options]
```

**Options:**

- `--token`: The sevdesk API token. If omitted, you will be prompted.

### `logout`

Log out by removing the stored API token.

```bash
sevdesk logout
```

### `doctor`

Check the CLI setup and the connection to the sevdesk API.

```bash
sevdesk doctor [options]
```

**Options:**

- `--json`: Output in JSON format.

### `accounts-datev:get`

Show a single booking account (AccountDatev), including hidden accounts that [`accounts-datev:list`](#accounts-datevlist) does not return. Backed by an undocumented sevdesk endpoint that may change without notice.

```bash
sevdesk accounts-datev:get [options]
```

**Options:**

- `--id`: The booking account ID. If omitted, you will be prompted.
- `--json`: Output in JSON format.

### `accounts-datev:list`

List booking accounts (AccountDatev). Covers only accounts visible in the sevdesk account picker; hidden accounts (for example some tax accounts) are reachable via [`accounts-datev:get`](#accounts-datevget). Backed by an undocumented sevdesk endpoint that may change without notice.

```bash
sevdesk accounts-datev:list [options]
```

**Options:**

- `--number`: Only show accounts with this account number. Filtered client-side across all visible accounts.
- `--name-like`: Only show accounts whose name contains this text. Filtered client-side across all visible accounts.
- `--limit`: Maximum number of accounts to return. Defaults to all of them.
- `--offset`: Number of accounts to skip before filtering.
- `--json`: Output in JSON format.

### `accounts:balance`

Show the balance of a check account at a given date. The balance is the sum of all transactions known to sevdesk, which is not necessarily the real bank balance.

```bash
sevdesk accounts:balance [options]
```

**Options:**

- `--id`: The check account ID. If omitted, you will be prompted.
- `--date`: The date to calculate the balance for (`YYYY-MM-DD`). Defaults to today.
- `--json`: Output in JSON format.

### `accounts:create-clearing`

Create a clearing check account.

```bash
sevdesk accounts:create-clearing [options]
```

**Options:**

- `--name`: The name of the check account. If omitted, you will be prompted.
- `--accounting-number`: The booking account number of the check account.
- `--json`: Output in JSON format.

### `accounts:create-file-import`

Create a check account that imports its transactions from files.

```bash
sevdesk accounts:create-file-import [options]
```

**Options:**

- `--name`: The name of the check account. If omitted, you will be prompted.
- `--import-type`: The file format used to import transactions. Supported values are `CSV` and `MT940`. Defaults to `CSV`.
- `--accounting-number`: The booking account number of the check account.
- `--iban`: The IBAN of the check account.
- `--json`: Output in JSON format.

### `accounts:get`

Show a single check account.

```bash
sevdesk accounts:get [options]
```

**Options:**

- `--id`: The check account ID. If omitted, you will be prompted.
- `--json`: Output in JSON format.

### `accounts:list`

List your check accounts.

```bash
sevdesk accounts:list [options]
```

**Options:**

- `--limit`: The maximum number of check accounts to return. Defaults to all of them.
- `--offset`: The number of check accounts to skip.
- `--json`: Output in JSON format.

### `contacts:add-address`

Add an address to a contact.

```bash
sevdesk contacts:add-address [options]
```

**Options:**

- `--contact`: The contact ID. If omitted, you will be prompted.
- `--street`: Street and house number.
- `--zip`: Zip code.
- `--city`: City name.
- `--country`: ID of the country as a StaticCountry ID, for example `1` for Germany. There is no lookup endpoint in this CLI, but an existing address of a contact reveals the IDs of other countries. If omitted, you will be prompted.
- `--category`: ID of the address category. The sevdesk API does not document the IDs, they are listed by a `GET` to `/Category?objectType=ContactAddress` and an existing address of a contact reveals the ones in use. If omitted, you will be prompted.
- `--json`: Output in JSON format.

### `contacts:add-email`

Add an e-mail address to a contact.

```bash
sevdesk contacts:add-email [options]
```

**Options:**

- `--contact`: The contact ID. If omitted, you will be prompted.
- `--email`: The e-mail address. If omitted, you will be prompted.
- `--key`: ID of the communication way key: `1` private, `2` work, `7` newsletter, `8` invoicing. Defaults to `2`.
- `--main`: Mark the e-mail address as the main one of the contact. Defaults to `false`.
- `--json`: Output in JSON format.

### `contacts:add-phone`

Add a phone number to a contact.

```bash
sevdesk contacts:add-phone [options]
```

**Options:**

- `--contact`: The contact ID. If omitted, you will be prompted.
- `--phone`: The phone number. If omitted, you will be prompted.
- `--key`: ID of the communication way key: `1` private, `2` work, `3` fax, `4` mobile. Defaults to `2`.
- `--main`: Mark the phone number as the main one of the contact. Defaults to `false`.
- `--json`: Output in JSON format.

### `contacts:create`

Create a contact. Use `--name` for organizations and `--surename` together with `--familyname` for persons.

```bash
sevdesk contacts:create [options]
```

**Options:**

- `--name`: Name of the organization. Not to be used for persons. If both `--name` and `--familyname` are omitted, you will be prompted for the organization name.
- `--surename`: First name of the person. Not to be used for organizations.
- `--familyname`: Last name of the person. Not to be used for organizations.
- `--category`: ID of the contact category: `2` supplier, `3` customer, `4` partner. Defaults to `3`.
- `--customer-number`: Customer number of the contact.
- `--description`: Description of the contact.
- `--vat-number`: VAT number of the contact.
- `--tax-number`: Tax number of the contact.
- `--json`: Output in JSON format.

### `contacts:delete`

Delete a contact.

```bash
sevdesk contacts:delete [options]
```

**Options:**

- `--id`: The contact ID. If omitted, you will be prompted.
- `--yes`: Skip the confirmation prompt. Defaults to `false`.
- `--json`: Output in JSON format.

### `contacts:delete-address`

Delete an address of a contact.

```bash
sevdesk contacts:delete-address [options]
```

**Options:**

- `--id`: The contact address ID, as shown by [`contacts:get`](#contactsget). If omitted, you will be prompted.
- `--yes`: Skip the confirmation prompt. Defaults to `false`.
- `--json`: Output in JSON format.

### `contacts:get`

Show a single contact with its addresses and communication ways.

```bash
sevdesk contacts:get [options]
```

**Options:**

- `--id`: The contact ID. If omitted, you will be prompted.
- `--json`: Output in JSON format. Prints an object with the keys `contact`, `addresses` and `communicationWays`.

### `contacts:list`

List contacts.

```bash
sevdesk contacts:list [options]
```

**Options:**

- `--name`: Filter by organization, first or last name.
- `--customer-number`: Filter by customer number.
- `--depth`: Contact depth: `0` returns only organizations, `1` organizations and persons. Defaults to `0`.
- `--category`: ID of the contact category to filter by: `2` supplier, `3` customer, `4` partner.
- `--limit`: Maximum number of contacts to return. Defaults to all of them.
- `--offset`: Number of contacts to skip.
- `--json`: Output in JSON format.

### `contacts:update`

Update a contact. Only the given fields are changed.

```bash
sevdesk contacts:update [options]
```

**Options:**

- `--id`: The contact ID. If omitted, you will be prompted.
- `--name`: Name of the organization. Not to be used for persons.
- `--surename`: First name of the person. Not to be used for organizations.
- `--familyname`: Last name of the person. Not to be used for organizations.
- `--category`: ID of the contact category: `2` supplier, `3` customer, `4` partner.
- `--customer-number`: Customer number of the contact.
- `--description`: Description of the contact.
- `--vat-number`: VAT number of the contact.
- `--tax-number`: Tax number of the contact.
- `--json`: Output in JSON format.

### `contacts:update-address`

Update an address of a contact. Only the given fields are changed.

```bash
sevdesk contacts:update-address [options]
```

**Options:**

- `--id`: The contact address ID, as shown by [`contacts:get`](#contactsget). If omitted, you will be prompted.
- `--street`: Street and house number.
- `--zip`: Zip code.
- `--city`: City name.
- `--country`: ID of the country as a StaticCountry ID, for example `1` for Germany.
- `--category`: ID of the address category.
- `--json`: Output in JSON format.

### `credit-notes:get`

Show a single credit note.

```bash
sevdesk credit-notes:get [options]
```

**Options:**

- `--id`: ID of the credit note. If omitted, you will be prompted.
- `--json`: Output in JSON format.

### `credit-notes:list`

List credit notes.

```bash
sevdesk credit-notes:list [options]
```

**Options:**

- `--status`: Filter by status: `100` draft, `200` open, `750` partially paid, `1000` paid.
- `--credit-note-number`: Filter by credit note number.
- `--start-date`: Only credit notes on or after this date as `dd.mm.yyyy` or Unix timestamp.
- `--end-date`: Only credit notes on or before this date as `dd.mm.yyyy` or Unix timestamp.
- `--contact`: ID of the contact whose credit notes to list.
- `--limit`: Maximum number of credit notes to return. Defaults to all of them.
- `--offset`: Number of credit notes to skip.
- `--json`: Output in JSON format.

### `credit-notes:pdf`

Download the PDF of a credit note.

```bash
sevdesk credit-notes:pdf [options]
```

**Options:**

- `--id`: ID of the credit note. If omitted, you will be prompted.
- `--output`: Path to write the PDF to. Defaults to the file name reported by the API.
- `--prevent-send-by`: Do not mark the credit note as sent by download. Defaults to `false`.
- `--json`: Output in JSON format.

### `export:contacts`

Export contacts as a CSV file.

```bash
sevdesk export:contacts [options]
```

**Options:**

- `--output`: Path to write the CSV file to. Defaults to the filename of the export.
- `--limit`: The maximum number of contacts to export.
- `--json`: Output in JSON format.

### `export:datev`

Export accounting data in the DATEV format as a ZIP archive. The export runs as a background job that the CLI waits for.

```bash
sevdesk export:datev [options]
```

**Options:**

- `--start-date`: Start of the export period as `dd.mm.yyyy` or Unix timestamp. If omitted, you will be prompted.
- `--end-date`: End of the export period as `dd.mm.yyyy` or Unix timestamp. If omitted, you will be prompted.
- `--format`: The DATEV export format. Supported values are `csv` and `xml`. Defaults to `csv`.
- `--scope`: The models to include as a string of letters: `E` (earnings), `X` (expenditure), `T` (transactions), `C` (cash register) and `D` (assets). XML exports support only `E` and `X`. Defaults to `EXTCD`.
- `--output`: Path to write the ZIP archive to. Defaults to the filename of the export.
- `--timeout`: Maximum number of seconds to wait for the export job. Defaults to `300`.
- `--json`: Output in JSON format.

### `export:invoices`

Export invoices as a CSV file.

```bash
sevdesk export:invoices [options]
```

**Options:**

- `--output`: Path to write the CSV file to. Defaults to the filename of the export.
- `--limit`: The maximum number of invoices to export.
- `--start-date`: Only export invoices on or after this date (ISO 8601).
- `--end-date`: Only export invoices on or before this date (ISO 8601).
- `--json`: Output in JSON format.

### `export:transactions`

Export transactions as a CSV file.

```bash
sevdesk export:transactions [options]
```

**Options:**

- `--output`: Path to write the CSV file to. Defaults to the filename of the export.
- `--limit`: The maximum number of transactions to export.
- `--start-date`: Only export transactions on or after this date (ISO 8601).
- `--end-date`: Only export transactions on or before this date (ISO 8601).
- `--json`: Output in JSON format.

### `export:vouchers`

Export vouchers as a CSV file.

```bash
sevdesk export:vouchers [options]
```

**Options:**

- `--output`: Path to write the CSV file to. Defaults to the filename of the export.
- `--limit`: The maximum number of vouchers to export.
- `--start-date`: Only export vouchers on or after this date (ISO 8601).
- `--end-date`: Only export vouchers on or before this date (ISO 8601).
- `--json`: Output in JSON format.

### `guidance:accounts`

List bookable accounts and their allowed tax rules. Covers only the ReceiptGuidance subset of VAT-relevant accounts — use [`accounts-datev:list`](#accounts-datevlist) for all booking accounts. The first matching filter wins: `--account-number`, `--tax-rule`, `--revenue`, `--expense`. Without a filter, all accounts are listed.

```bash
sevdesk guidance:accounts [options]
```

**Options:**

- `--account-number`: Only show the account with this datev account number.
- `--tax-rule`: Tax rule name, for example `USTPFL_UMS_EINN`.
- `--revenue`: Only show accounts that can be used for revenue. Defaults to `false`.
- `--expense`: Only show accounts that can be used for expenses. Defaults to `false`.
- `--json`: Output in JSON format.

### `invoices:get`

Show a single invoice.

```bash
sevdesk invoices:get [options]
```

**Options:**

- `--id`: ID of the invoice. If omitted, you will be prompted.
- `--json`: Output in JSON format.

### `invoices:list`

List invoices.

```bash
sevdesk invoices:list [options]
```

**Options:**

- `--status`: Filter by status: `50` deactivated recurring, `100` draft, `200` open, `750` partially paid, `1000` paid.
- `--invoice-number`: Filter by invoice number.
- `--start-date`: Only invoices on or after this date as `dd.mm.yyyy` or Unix timestamp.
- `--end-date`: Only invoices on or before this date as `dd.mm.yyyy` or Unix timestamp.
- `--contact`: ID of the contact whose invoices to list.
- `--limit`: Maximum number of invoices to return. Defaults to all of them.
- `--offset`: Number of invoices to skip.
- `--json`: Output in JSON format.

### `invoices:pdf`

Download the PDF of an invoice.

```bash
sevdesk invoices:pdf [options]
```

**Options:**

- `--id`: ID of the invoice. If omitted, you will be prompted.
- `--output`: Path to write the PDF to. Defaults to the file name reported by the API.
- `--prevent-send-by`: Do not mark the invoice as sent by download. Defaults to `false`.
- `--json`: Output in JSON format.

### `orders:get`

Show a single order.

```bash
sevdesk orders:get [options]
```

**Options:**

- `--id`: ID of the order. If omitted, you will be prompted.
- `--json`: Output in JSON format.

### `orders:list`

List orders.

```bash
sevdesk orders:list [options]
```

**Options:**

- `--status`: Filter by status: `100` draft, `200` delivered, `300` rejected, `500` accepted, `750` partially calculated, `1000` calculated.
- `--order-number`: Filter by order number.
- `--start-date`: Only orders on or after this date as `dd.mm.yyyy` or Unix timestamp.
- `--end-date`: Only orders on or before this date as `dd.mm.yyyy` or Unix timestamp.
- `--contact`: ID of the contact whose orders to list.
- `--limit`: Maximum number of orders to return. Defaults to all of them.
- `--offset`: Number of orders to skip.
- `--json`: Output in JSON format.

### `orders:pdf`

Download the PDF of an order.

```bash
sevdesk orders:pdf [options]
```

**Options:**

- `--id`: ID of the order. If omitted, you will be prompted.
- `--output`: Path to write the PDF to. Defaults to the file name reported by the API.
- `--prevent-send-by`: Do not mark the order as sent by download. Defaults to `false`.
- `--json`: Output in JSON format.

### `parts:get`

Show a single part.

```bash
sevdesk parts:get [options]
```

**Options:**

- `--id`: The part ID. If omitted, you will be prompted.
- `--json`: Output in JSON format.

### `parts:list`

List parts.

```bash
sevdesk parts:list [options]
```

**Options:**

- `--name`: Filter by part name.
- `--part-number`: Filter by part number.
- `--limit`: Maximum number of parts to return. Defaults to all of them.
- `--offset`: Number of parts to skip.
- `--json`: Output in JSON format.

### `tags:create`

Create a tag and attach it to a document.

```bash
sevdesk tags:create [options]
```

**Options:**

- `--name`: Name of the tag. If omitted, you will be prompted.
- `--object-type`: Type of the document to tag: `Invoice`, `Voucher`, `Order` or `CreditNote`. If omitted, you will be prompted.
- `--object-id`: ID of the document to tag. If omitted, you will be prompted.
- `--json`: Output in JSON format.

### `tags:delete`

Delete a tag.

```bash
sevdesk tags:delete [options]
```

**Options:**

- `--id`: The tag ID. If omitted, you will be prompted.
- `--yes`: Skip the confirmation prompt. Defaults to `false`.
- `--json`: Output in JSON format.

### `tags:list`

List tags.

```bash
sevdesk tags:list [options]
```

**Options:**

- `--limit`: Maximum number of tags to return. Defaults to all of them.
- `--offset`: Number of tags to skip.
- `--json`: Output in JSON format.

### `transactions:create`

Create a transaction. Only use this on file import (online) check accounts.

```bash
sevdesk transactions:create [options]
```

**Options:**

- `--check-account`: The ID of the check account the transaction belongs to. If omitted, you will be prompted.
- `--amount`: The amount of the transaction. Negative for expenses. If omitted, you will be prompted.
- `--payee`: The name of the payee or payer. If omitted, you will be prompted.
- `--value-date`: The date the transaction was booked (ISO 8601). Defaults to now.
- `--entry-date`: The date the transaction was imported (ISO 8601).
- `--purpose`: The payment purpose of the transaction.
- `--status`: The status of the transaction: `100` created, `200` linked, `300` private, `400` booked. Defaults to `100`.
- `--json`: Output in JSON format.

### `transactions:get`

Show a single transaction.

```bash
sevdesk transactions:get [options]
```

**Options:**

- `--id`: The transaction ID. If omitted, you will be prompted.
- `--json`: Output in JSON format.

### `transactions:list`

List transactions of your check accounts.

```bash
sevdesk transactions:list [options]
```

**Options:**

- `--check-account`: Only show transactions of this check account ID.
- `--unbooked`: Only show transactions with status `100` (created). Filtered client-side because the sevdesk API ignores its `isBooked=false` filter. Defaults to `false`.
- `--start-date`: Only show transactions on or after this date (ISO 8601).
- `--end-date`: Only show transactions on or before this date (ISO 8601).
- `--payee`: Only show transactions with this payee or payer name.
- `--purpose`: Only show transactions with this payment purpose.
- `--limit`: The maximum number of transactions to return. Defaults to all of them.
- `--offset`: The number of transactions to skip.
- `--json`: Output in JSON format.

### `vouchers:book`

Book a payment on a voucher. For online check accounts (bank, PayPal, file import), pass the existing bank transaction via `--transaction`. For clearing accounts and cash registers, omit `--transaction` and sevdesk creates the transaction automatically.

```bash
sevdesk vouchers:book [options]
```

**Options:**

- `--id`: ID of the voucher. If omitted, you will be prompted.
- `--amount`: Amount to book. Can also be a partial amount. Pass it as a positive number — the sign is derived from the voucher, which the API requires to be negative for expense vouchers. If omitted, you will be prompted.
- `--date`: Booking date as ISO 8601. Defaults to now.
- `--type`: Type of the booking. Supported values are `FULL_PAYMENT`, `N` (partial), `CB` (cash discount), `O` (other), `OF` (reminder charges) and `MTC` (monetary traffic costs). Defaults to `FULL_PAYMENT`.
- `--check-account`: ID of the check account. If omitted, you will be prompted.
- `--transaction`: ID of the bank transaction to link. Required for online check accounts, omit for clearing accounts.
- `--create-feed`: Create a feed entry for the booking.
- `--yes`: Skip the confirmation prompt. Defaults to `false`.
- `--json`: Output in JSON format.

### `vouchers:create`

Create a voucher from a receipt file. The file is uploaded and attached to the voucher, which is created with a single position.

```bash
sevdesk vouchers:create [options]
```

**Options:**

- `--file`: Path to the receipt file to attach, for example a PDF, an image or an XML invoice. If omitted, you will be prompted.
- `--status`: Status of the created voucher. Supported values are `draft` and `open`. Defaults to `open`.
- `--credit-debit`: `C` for expense (credit), `D` for income (debit) vouchers. Defaults to `C`.
- `--tax-rule`: ID of the tax rule, for example `9` for deductible input tax expenses. If omitted, you will be prompted.
- `--account-datev`: ID of the booking account (AccountDatev). Find it with [`guidance:accounts`](#guidanceaccounts). If omitted, you will be prompted.
- `--amount`: Amount of the voucher position. If omitted, you will be prompted.
- `--net`: Treat the amount as net instead of gross. Defaults to `false`.
- `--tax-rate`: Tax rate of the voucher position in percent. Defaults to `19`.
- `--voucher-date`: Date as `dd.mm.yyyy` or Unix timestamp.
- `--pay-date`: Date as `dd.mm.yyyy` or Unix timestamp.
- `--delivery-date`: Start of the service period (Leistungszeitraum), or the single service date, as `dd.mm.yyyy` or Unix timestamp.
- `--delivery-date-until`: End of the service period as `dd.mm.yyyy` or Unix timestamp. Requires `--delivery-date`.
- `--supplier-id`: ID of the supplier contact.
- `--supplier-name`: Name of the supplier, used when no supplier ID is given.
- `--description`: The voucher number.
- `--comment`: Comment for the voucher position.
- `--json`: Output in JSON format.

### `vouchers:enshrine`

Enshrine a voucher so that it can no longer be changed. **This cannot be undone.**

```bash
sevdesk vouchers:enshrine [options]
```

**Options:**

- `--id`: ID of the voucher. If omitted, you will be prompted.
- `--yes`: Skip the confirmation prompt. Defaults to `false`.
- `--json`: Output in JSON format.

### `vouchers:get`

Show a single voucher.

```bash
sevdesk vouchers:get [options]
```

**Options:**

- `--id`: ID of the voucher. If omitted, you will be prompted.
- `--json`: Output in JSON format.

### `vouchers:list`

List vouchers.

```bash
sevdesk vouchers:list [options]
```

**Options:**

- `--status`: Filter by status: `50` draft, `100` open, `150` transferred, `750` partially paid, `1000` paid.
- `--credit-debit`: Filter by `C` for expense or `D` for income vouchers.
- `--description-like`: Filter by voucher number, matching partially.
- `--start-date`: Only vouchers on or after this date as `dd.mm.yyyy` or Unix timestamp.
- `--end-date`: Only vouchers on or before this date as `dd.mm.yyyy` or Unix timestamp.
- `--contact`: ID of the contact whose vouchers to list.
- `--limit`: Maximum number of vouchers to return. Defaults to all of them.
- `--offset`: Number of vouchers to skip.
- `--json`: Output in JSON format.

### `vouchers:positions`

List voucher positions.

```bash
sevdesk vouchers:positions [options]
```

**Options:**

- `--voucher`: ID of the voucher whose positions to list.
- `--limit`: Maximum number of positions to return. Defaults to all of them.
- `--offset`: Number of positions to skip.
- `--json`: Output in JSON format.

### `vouchers:reset-to-draft`

Reset a voucher to the draft status. This unlinks existing payments.

```bash
sevdesk vouchers:reset-to-draft [options]
```

**Options:**

- `--id`: ID of the voucher. If omitted, you will be prompted.
- `--yes`: Skip the confirmation prompt. Defaults to `false`.
- `--json`: Output in JSON format.

### `vouchers:reset-to-open`

Reset a voucher to the open status. This unlinks existing payments.

```bash
sevdesk vouchers:reset-to-open [options]
```

**Options:**

- `--id`: ID of the voucher. If omitted, you will be prompted.
- `--yes`: Skip the confirmation prompt. Defaults to `false`.
- `--json`: Output in JSON format.

## License

See [LICENSE](https://github.com/genz-its/sevdesk/blob/main/LICENSE).

[^1]: This project is not affiliated with, endorsed by, sponsored by, or approved by sevDesk GmbH or any of their affiliates or subsidiaries.
