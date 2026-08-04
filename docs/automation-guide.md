# Automation Guide

How to set up an automated voucher workflow (upload receipts, match them to open bank transactions, book them) on top of `@genz-its/sevdesk-cli`.

## 1. API token

- Create the token in sevdesk under **Settings > User > API token**. It belongs to that (admin) user and never expires — but it dies irrecoverably if the user is deleted, so use a dedicated service user if possible.
- Regenerating the token invalidates the old one immediately, and it cannot be shown again — store it in your secret manager right away.
- Provide it to the automation via the **`SEVDESK_TOKEN`** environment variable. Never commit it and never pass it as a CLI argument in shared scripts.

## 2. One-time checks

- Run `sevdesk doctor` — it must report **bookkeeping system version 2.0**. Accounts on version 1.0 are not supported.
- Look up your check account IDs with `sevdesk accounts:list` and note their types: **online** accounts (bank, PayPal, file import) require an existing bank transaction when booking, while **offline** accounts (clearing accounts, cash registers) create the transaction themselves.

## 3. Booking accounts and tax rules

- Find valid booking accounts with `sevdesk guidance:accounts --expense`. Each account lists its **allowed tax rules and rates** — using a rate outside the allowed set is rejected by the API (HTTP 422).
- Typical cases: domestic expenses with VAT use the deductible input tax rule with the invoice's tax rate. **Invoices from foreign SaaS vendors are usually Reverse Charge (§13b UStG) — 0% tax rate with the matching reverse-charge rule.** Getting this wrong is the most common mistake; have accounting sign off a vendor-to-account/tax-rule mapping table once, then automate against it.

## 4. Creating vouchers

```bash
sevdesk vouchers:create \
  --file receipt.pdf \
  --supplier-id <contactId> \
  --description <invoice number> \
  --voucher-date <dd.mm.yyyy> \
  --amount <gross> \
  --tax-rule <taxRuleId> \
  --account-datev <accountDatevId>
```

- Prefer `--supplier-id` (existing contact, ID via `sevdesk contacts:list --json`) over `--supplier-name` free text — vouchers then aggregate correctly per supplier.
- Always set `--description` to the **vendor's invoice number** and `--voucher-date` to the invoice date.
- **Duplicate guard**: sevdesk does not deduplicate. Before creating, check `sevdesk vouchers:list --description-like "<invoice number>" --json` and skip if it already exists.
- Use `--status draft` if accounting wants to review before booking; the default `open` is for the fully automated path.

## 5. Matching and booking

```bash
# Candidates
sevdesk transactions:list --unbooked --check-account <checkAccountId> --json
```

- Match on: voucher gross equals the absolute transaction amount (expenses are negative), value date within a few days of the invoice or pay date, and payee name similar to the supplier name. **Only auto-book unambiguous matches; queue the rest for human review.**

```bash
sevdesk vouchers:book \
  --id <voucherId> \
  --amount <gross> \
  --check-account <checkAccountId> \
  --transaction <transactionId> \
  --date <transaction value date> \
  --yes
```

- `--transaction` is **required** for online check accounts and **must be omitted** for offline ones.
- Pass the transaction's value date as `--date` — the default is "now", which would falsify the payment date.
- Partial payment: `--type N` with the partial amount; the voucher moves to status `750`.
- Wrong match? `sevdesk vouchers:reset-to-open --id <voucherId> --yes` unlinks the payment — **unless the voucher is enshrined**.

## 6. Guardrails

- **Never enshrine automatically** (`vouchers:enshrine` is irreversible). Leave enshrining to the accountant or the DATEV export process.
- Rely on exit codes (`0` success, `1` failure) and `--json`; the CLI never prompts when run without a TTY or with `CI=1`.
- sevdesk documents no rate limit, but be gentle: paginate with `--limit` (maximum 1000) and avoid tight retry loops — the SDK already retries with backoff.
- Subscribe to the [sevdesk API newsletter](https://landing.sevdesk.de/api-newsletter) — it is the only breaking-change channel. A scheduled `sevdesk doctor --json` makes a good health check.
- Dry-run new logic against a **sevdesk trial account** (trials run on the highest tariff) before pointing it at production.

## 7. Historical analysis

- Reuse past decisions instead of guessing: `sevdesk vouchers:positions --voucher <voucherId> --json` shows which **booking account and tax rate** a supplier's earlier vouchers used. Look up the supplier's vouchers with `sevdesk vouchers:list --contact <contactId> --json` first.
- Positions of vouchers created before the account's sevdesk-Update 2.0 migration carry a legacy `accountingType` instead of `accountDatev` and no tax rule — this is inherent to the bookkeeping-system migration, so resolve their booking accounts via the legacy ID or skip pre-2.0 vouchers in the analysis.
- The API does **not** expose the link between a booked voucher and its bank transaction. Use `sevdesk transactions:list --unbooked` to see what is still open, and infer historical voucher-transaction mappings via amount, date, and supplier.
