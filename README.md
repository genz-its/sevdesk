# sevdesk

[![CI](https://github.com/mi-skam/sevdesk/actions/workflows/ci.yml/badge.svg)](https://github.com/mi-skam/sevdesk/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/mi-skam/sevdesk)](https://github.com/mi-skam/sevdesk/releases/latest)
[![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

Unofficial Node.js SDK and CLI for the [sevdesk](https://sevdesk.de/) API.[^1]

## Packages

| Package                                    | Description                                    |
| ------------------------------------------ | ---------------------------------------------- |
| [`@genz-its/sevdesk-sdk`](./packages/sdk/) | Unofficial Node.js SDK for the sevdesk API.    |
| [`@genz-its/sevdesk-cli`](./packages/cli/) | Unofficial command-line interface for sevdesk. |

## Distribution and upstream

This repository maintains an independent distribution based on
[genz-its/sevdesk](https://github.com/genz-its/sevdesk), retaining the original MIT
license and author attribution. Releases are published on
[GitHub](https://github.com/mi-skam/sevdesk/releases), not npm. The original
`@genz-its` package names are retained for import compatibility; installing those
names from the npm registry installs the **upstream** distribution, not this one.

### Install v0.2.0

Requires Node.js 22 or later:

```bash
npm install -g https://github.com/mi-skam/sevdesk/releases/download/v0.2.0/sevdesk-cli-0.2.0.tgz
sevdesk --version
```

The CLI tarball bundles this release's SDK, so installation does not resolve the
SDK from upstream npm. Other CLI dependencies are installed from npm. The SDK is
also available independently:

```bash
npm install https://github.com/mi-skam/sevdesk/releases/download/v0.2.0/sevdesk-sdk-0.2.0.tgz
```

Release assets include `SHA256SUMS` for checksum verification.
See [v0.2.0 release notes](./docs/releases/v0.2.0.md), including breaking changes.

## Features

- **Draft invoices (Rechnungsentwürfe):** create, partially update, replace positions, detect duplicate draft numbers, and delete drafts. Offline previews never access the account; email sending explicitly confirms finalisation and refuses resends.
- **Quotes (Angebote):** a shared structured JSON model and interactive editor, customer selection, editable positions, local import/export, draft saving, PDF previews, and explicit sending.
- **Document numbering (Nummernkreise):** inspect configured formats and suggest the next unused number, including existing drafts. Suggestions are **not reservations**; duplicate checks are not atomic.
- **Recovery (Wiederherstellung):** private quote snapshots and operation receipts preserve local work and identify uncertain creation or sending outcomes. Unknown outcomes never trigger automatic recreation or resending.
- **Accounting workflows:** receipt uploads (Belege), bank transactions, payment booking, contacts, account lookups, and DATEV/CSV exports through the SDK.

Account-specific defaults are not inferred from historical documents. Quote totals are indicative; sevdesk remains authoritative.

## Getting started

Node.js 22 or later and a sevdesk account on bookkeeping system version 2.0 are required for account operations. Offline previews do not require authentication.

### Run from source

Build locally to use the workflows described here:

```bash
git clone https://github.com/mi-skam/sevdesk.git
cd sevdesk
npm ci
npm run build

node packages/cli/dist/index.js --help
```

Examples from the repository root:

```bash
# Validate and preview a draft invoice offline; does not create it
node packages/cli/dist/index.js invoices:create invoice.json --dry-run --json

# Preview the invented quote example offline; does not save or send
node packages/cli/dist/index.js quotes:create packages/cli/examples/quote.example.json --dry-run --json

# Start the interactive quote editor; remote saving/sending requires confirmation
node packages/cli/dist/index.js quotes:create

# Inspect an existing invoice and its positions (requires authentication)
node packages/cli/dist/index.js invoices:get 42 --positions --json

# Inspect quote numbering without reserving a number (requires authentication)
node packages/cli/dist/index.js numbering:get --kind quote --suggest --json
```

Use `node packages/cli/dist/index.js login` to configure authentication for account operations, or supply `SEVDESK_TOKEN` through your environment. Never commit credentials.

See the [SDK documentation](./packages/sdk/README.md), [CLI command reference](./packages/cli/README.md), [invoice JSON format](./packages/cli/README.md#invoicescreate), and [quote workflow and JSON reference](./packages/cli/docs/quotes.md) for details.

### CLI argument conventions

Primary files and target IDs are positional and precede options:

```bash
sevdesk invoices:create invoice.json --dry-run --json
sevdesk invoices:get 42 --positions --json
sevdesk vouchers:create receipt.pdf --supplier-name "ACME GmbH" --amount 119 --tax-rule 9 --account-datev 26
sevdesk quotes:pdf 42 --output quote.pdf --json
sevdesk quotes:send 42 quote.json --dry-run --json
```

These examples use the `sevdesk` command name; when running from source, substitute `node packages/cli/dist/index.js` as above. Creating a voucher uploads the receipt and creates a remote record; it is **not** a preview.

**Breaking change:** target `--id`, `contacts:add-* --contact`, and `vouchers:create --file` flags have been removed **without compatibility aliases**. Update existing scripts accordingly. IDs must be positive safe integers. Existing interactive prompts remain available when their positional input is omitted; non-interactive calls must supply required inputs.

Filters such as `invoices:list --contact 7`, relationship settings such as `--check-account` and `--transaction`, and destinations such as `--output` remain named options. Exit codes and existing write confirmations are unchanged. For invoices, `invoices:list --drafts --json` returns `{ invoices, warnings }`; duplicate draft numbers also produce that envelope without `--drafts`. Other invoice list results retain the legacy JSON array.

### Upstream npm packages

For the published upstream versions, rather than this distribution:

```bash
npm install @genz-its/sevdesk-sdk
# Or install the upstream CLI globally
npm install -g @genz-its/sevdesk-cli
```

Consult the upstream documentation for the syntax supported by those releases.

## Guides

- [Automation Guide](./docs/automation-guide.md) — Build an automated voucher workflow on top of the CLI.
- [Quote Guide](./packages/cli/docs/quotes.md) — Edit, validate, save, send, and recover quotes (Angebote).

## Development

```bash
npm ci
npm run build
npm run lint
npm run typecheck
npm test
npm run test:terminal
```

### GitHub releases

Both packages share a release version. Update both manifests and the CLI's pinned
SDK dependency, refresh `package-lock.json`, and add `docs/releases/vX.Y.Z.md`.
After checks pass and the changes are merged to `main`, push tag `vX.Y.Z`.
The `GitHub release` workflow validates the tag/version match, builds and tests,
creates tarballs, verifies isolated installation, and publishes assets and checksums.
It never runs `npm publish`. The separate upstream release-please workflow remains
disabled in this repository.

To build and verify assets locally after `npm run build`:

```bash
npm run release:pack
npm run release:verify
```

Artifacts are written to ignored `release-artifacts/`. Verification installs only
into temporary directories and runs offline CLI previews; it does not access sevdesk.

Unit tests use mocked API calls. The terminal suite requires Python 3 on macOS/Linux and exercises the real prompt renderer with fake credentials, temporary state, and mocked HTTP. It does not create live documents or send real emails. CI runs on Node.js 22 and 24.

The [official OpenAPI specification](https://api.sevdesk.de/openapi.yaml) serves as a local development reference:

```bash
curl -fsSL https://api.sevdesk.de/openapi.yaml -o openapi.yaml
```

## License

See [LICENSE](./LICENSE).

[^1]: This project is not affiliated with, endorsed by, sponsored by, or approved by sevDesk GmbH or any of their affiliates or subsidiaries.
