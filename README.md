# sevdesk

[![CI](https://github.com/mi-skam/sevdesk/actions/workflows/ci.yml/badge.svg)](https://github.com/mi-skam/sevdesk/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/mi-skam/sevdesk)](https://github.com/mi-skam/sevdesk/releases/latest)
[![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

Unofficial Node.js SDK and CLI for the [sevdesk](https://sevdesk.de/) API.[^1]

## Packages

| Package                                   | Description                                    |
| ----------------------------------------- | ---------------------------------------------- |
| [`@mi-skam/sevdesk-sdk`](./packages/sdk/) | Unofficial Node.js SDK for the sevdesk API.    |
| [`@mi-skam/sevdesk`](./packages/cli/)     | Unofficial command-line interface for sevdesk. |

## Distribution and upstream

This repository is an independent distribution based on
[genz-its/sevdesk](https://github.com/genz-its/sevdesk); the original MIT license and
copyright notice are retained in [LICENSE](./LICENSE). Releases are published on
[GitHub](https://github.com/mi-skam/sevdesk/releases), not npm.

Since 0.3.0 the packages are named `@mi-skam/sevdesk-sdk` and `@mi-skam/sevdesk`
(previously `@genz-its/sevdesk-sdk` and `@genz-its/sevdesk-cli`). Update imports
from `@genz-its/sevdesk-sdk` to `@mi-skam/sevdesk-sdk`; the `sevdesk` command name
is unchanged. The `@genz-its` names on npm belong to the upstream distribution.

### Install a release

Requires Node.js 22.13 or later (the SDK alone: 22). Download `sevdesk-cli-X.Y.Z.tgz`
from the [latest release](https://github.com/mi-skam/sevdesk/releases/latest), then:

```bash
npm install -g ./sevdesk-cli-X.Y.Z.tgz
sevdesk --version
```

The CLI tarball bundles this release's SDK, so installation does not resolve the
SDK from upstream npm. Other CLI dependencies are installed from npm. The SDK is
also available independently:

```bash
npm install ./sevdesk-sdk-X.Y.Z.tgz
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

Node.js 22.13 or later and a sevdesk account on bookkeeping system version 2.0 are required for account operations. Offline previews do not require authentication.

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

The upstream distribution is published to npm under different names and does not include the changes in this repository:

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

### Releases

Releases are GitHub releases only; nothing is published to npm. Both packages always share one version, tagged `vX.Y.Z`. Shipping a release takes one manual step: merging the release PR.

1. **Use conventional commit prefixes.** When squash-merging, the PR title becomes the commit message, so give the title the prefix. While the version is below 1.0:

   | Prefix                                         | Example                          | Effect (from 0.1.0) |
   | ---------------------------------------------- | -------------------------------- | ------------------- |
   | `fix:`                                         | `fix: handle empty voucher list` | 0.1.1               |
   | `feat:`                                        | `feat: add tags:update command`  | 0.1.1               |
   | `feat!:` or `BREAKING CHANGE:` in the body     | `feat!: rename --payee option`   | 0.2.0               |
   | `chore:`, `ci:`, `docs:`, `test:`, `refactor:` | `docs: fix README typo`          | no release          |

2. **release-please opens a release PR (automatic).** After each push to `main`, the Release workflow opens or updates a `chore: release X.Y.Z` PR if there are `fix:` or `feat:` commits since the last release. It bumps both package versions, the CLI's pinned SDK version and the lockfile, and updates `CHANGELOG.md`. Don't edit it; it keeps updating itself.

3. **Merge the release PR when you want to ship.** Use merge or squash, never rebase:

   ```bash
   gh pr list
   gh pr merge <number> --merge
   ```

4. **The release is created (automatic, about 2–3 minutes).** The Release workflow tags `vX.Y.Z` and creates the GitHub release with the changelog as notes. It then calls `.github/workflows/github-release.yml`, which builds, lints, typechecks and tests the tag, packs the tarballs, verifies that they install and run, and attaches `sevdesk-sdk-X.Y.Z.tgz`, `sevdesk-cli-X.Y.Z.tgz` and `SHA256SUMS`.

5. **Check it worked.** The Release run should be green and the release should list three assets:

   ```bash
   gh run list --limit 3
   gh release view vX.Y.Z
   ```

To install a release, see [Getting started](#getting-started).

**If something goes wrong:**

- **The release has no files:** look at the failed run with `gh run view --log-failed`. Fix the problem on `main`, then rebuild and attach the files to the existing release with `gh workflow run github-release.yml -f tag=vX.Y.Z`.
- **No release PR appears:** there are no `fix:` or `feat:` commits since the last release. Check your commit prefixes.

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
