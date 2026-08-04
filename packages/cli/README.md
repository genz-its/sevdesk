# @genz-its/sevdesk-cli

Unofficial command-line interface for the [sevdesk](https://sevdesk.de/) API.[^1]

## Features

- 🧾 **Vouchers**: Create vouchers from receipt files (PDF, image, XML), list, book, reset and enshrine them.
- 💳 **Transactions**: List and filter bank transactions, for example the ones that are not booked yet.
- 🏦 **Check accounts**: List accounts, query balances, and create clearing or file import accounts.
- 🧭 **Receipt guidance**: Find bookable accounts and their allowed tax rules.
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
- [`accounts:balance`](#accountsbalance)
- [`accounts:create-clearing`](#accountscreate-clearing)
- [`accounts:create-file-import`](#accountscreate-file-import)
- [`accounts:get`](#accountsget)
- [`accounts:list`](#accountslist)
- [`guidance:accounts`](#guidanceaccounts)
- [`transactions:create`](#transactionscreate)
- [`transactions:get`](#transactionsget)
- [`transactions:list`](#transactionslist)
- [`vouchers:book`](#vouchersbook)
- [`vouchers:create`](#voucherscreate)
- [`vouchers:enshrine`](#vouchersenshrine)
- [`vouchers:get`](#vouchersget)
- [`vouchers:list`](#voucherslist)
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

- `--limit`: The maximum number of check accounts to return.
- `--offset`: The number of check accounts to skip.
- `--json`: Output in JSON format.

### `guidance:accounts`

List bookable accounts and their allowed tax rules. The first matching filter wins: `--account-number`, `--tax-rule`, `--revenue`, `--expense`. Without a filter, all accounts are listed.

```bash
sevdesk guidance:accounts [options]
```

**Options:**

- `--account-number`: Only show the account with this datev account number.
- `--tax-rule`: Tax rule name, for example `USTPFL_UMS_EINN`.
- `--revenue`: Only show accounts that can be used for revenue. Defaults to `false`.
- `--expense`: Only show accounts that can be used for expenses. Defaults to `false`.
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
- `--unbooked`: Only show transactions that are not yet booked. Defaults to `false`.
- `--start-date`: Only show transactions on or after this date (ISO 8601).
- `--end-date`: Only show transactions on or before this date (ISO 8601).
- `--payee`: Only show transactions with this payee or payer name.
- `--purpose`: Only show transactions with this payment purpose.
- `--limit`: The maximum number of transactions to return.
- `--offset`: The number of transactions to skip.
- `--json`: Output in JSON format.

### `vouchers:book`

Book a payment on a voucher. For online check accounts (bank, PayPal, file import), pass the existing bank transaction via `--transaction`. For clearing accounts and cash registers, omit `--transaction` and sevdesk creates the transaction automatically.

```bash
sevdesk vouchers:book [options]
```

**Options:**

- `--id`: ID of the voucher. If omitted, you will be prompted.
- `--amount`: Amount to book. Can also be a partial amount. If omitted, you will be prompted.
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
- `--limit`: Maximum number of vouchers to return.
- `--offset`: Number of vouchers to skip.
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

[MIT](../../LICENSE)

[^1]: This project is not affiliated with, endorsed by, sponsored by, or approved by sevDesk GmbH or any of their affiliates or subsidiaries.
