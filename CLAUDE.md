# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Live API safety (strict)

The CLI runs against a real sevdesk account.

- Read-only commands (`*:list`, `*:get`, `accounts:balance`, `guidance:accounts`, `doctor`, `export:*`) may be run freely.
- **Never run a command that writes** — `*:create*`, `*:update`, `*:delete`, `vouchers:book`, `vouchers:enshrine`, `vouchers:reset-to-*`, `login`, `logout` — without asking first and getting an explicit yes for that specific run. Enshrining cannot be undone.
- **Never read, print or copy the API token.** Do not open `~/.config/sevdesk/config.json` and do not echo `SEVDESK_TOKEN`. Touch the account only through the CLI.

## Commands

```bash
npm install
npm run build                 # tsdown build in every workspace
npm test                      # vitest run in every workspace
npm run typecheck             # tsc --noEmit in every workspace
npm run lint                  # eslint . && prettier --check .
npm run fmt                   # eslint --fix . && prettier --write .

npm test -w @genz-its/sevdesk-sdk -- vouchers      # single test file (vitest name filter)
npm test -w @genz-its/sevdesk-cli -- --watch

node packages/cli/dist/index.js <command>          # run the built CLI locally
```

CI runs `build`, `lint`, `typecheck` and `test` on Node 22 and 24. Node >= 22 is required.

## Architecture

npm workspaces monorepo with two published packages. **The CLI is a thin layer over the SDK — never call the sevdesk API directly from CLI code.**

### `packages/sdk` — `@genz-its/sevdesk-sdk`

Zero runtime dependencies, native `fetch`, ESM only.

- `src/http-client.ts` — the only place that talks to the network. Owns auth (raw token in `Authorization`, no `Bearer`), timeouts via `AbortSignal.timeout`, retries (GET/PUT/DELETE only, on network errors + 429/5xx, honoring `Retry-After`), query serialization (`booleans → 1/0`, arrays → comma-joined) and unwrapping of the sevdesk `{ objects: … }` envelope. `request<T>()` returns the unwrapped payload; empty bodies return `undefined`.
- `src/resources/*.ts` — one class per API area, each extending `BaseResource` and receiving the shared `HttpClient`. `SevDesk` in `src/client.ts` instantiates all of them as readonly properties.
- `src/types.ts` — shared `DateInput`, `ListOptions`, `ModelRef` (requests, numeric id) vs `ModelRefResponse` (responses, string id).
- `src/dates.ts` — three serializers because endpoints disagree: `toVoucherDate` (`dd.mm.yyyy` or Unix seconds), `toIsoDateTime`, `toPlainDate`.
- `src/index.ts` re-exports everything; new resources must be added there.

### `packages/cli` — `@genz-its/sevdesk-cli` (bin `sevdesk`)

Built on `@robingenz/zli` + `zod` + `consola`.

- `src/index.ts` — registers every command in a flat `commands` map keyed `group:action` (e.g. `vouchers:book`). New commands must be imported and registered here. Top-level try/catch funnels all errors through `formatError`, then sets exit code 1.
- `src/commands/<group>/<action>.ts` — one `defineCommand({ description, options: defineOptions(z.object({…})), action })` per file, default-exported.
- `src/client.ts` — `requireClient()` resolves the token and exits with a hint if absent; `createClient()` sets the CLI `User-Agent`.
- `src/config.ts` — token resolution order: `SEVDESK_TOKEN` env var → `~/.config/sevdesk/config.json` (respects `XDG_CONFIG_HOME`, written with mode `0600`). No OS keyring.
- `src/options.ts` / `src/prompt.ts` / `src/interactive.ts` — `requireStringOption`/`requireNumberOption`/`confirmOrAbort` prompt when interactive and exit 1 with an explanatory message when not. Non-interactive = no TTY or `CI` set.
- `src/output.ts` — `printJson`, `printTable`, `contactLabel`.
- `src/errors.ts` — maps `ZliError`, `ZodError` and `SevDeskError` (401 → "run `sevdesk login`") to user-facing strings.

## Conventions

- **Hand-written types only.** `openapi.yaml` is a local reference download, not a codegen source — it is wrong about media types, `voucherPosSave`, pagination and filters. Never generate code from it.
- **Bookkeeping system 2.0 only** (`taxRule`, `accountDatev`). 1.0 accounts are rejected by `login` and flagged by `doctor`.
- SDK methods take a single options object and are documented with a one-line JSDoc naming the endpoint (`/** Retrieves vouchers via \`GET /Voucher\`. */`). Non-obvious API behavior belongs in JSDoc on the affected field.
- The sevdesk API returns all scalars as strings, including ids — response interfaces reflect that.
- Endpoints that return a single object still return an array; resources take `[0]` and throw a synthetic `SevDeskError` 404 when empty.
- **Every CLI command supports `--json`**; destructive ones support `--yes`. Exit codes are `0`/`1` only. These are the automation primitives the separate matching-automation repo depends on — do not break them.
- CLI list commands print a table by default and `consola.info('No … found.')` on empty results.
- Documenting a new command means adding it to the list _and_ the reference section in `packages/cli/README.md`; new SDK resources go in the resources table in `packages/sdk/README.md`.

## API quirks to preserve

- `GET /CheckAccountTransaction` ignores `isBooked=false`; `transactions:list --unbooked` filters client-side on `status === '100'` (so `--limit` may yield fewer rows).
- `/AccountDatev` is **undocumented**. `list` returns only non-hidden accounts and ignores every filter except `limit`/`offset`; `get` reaches hidden accounts. The documented alternative, `ReceiptGuidanceResource`, only covers the VAT-relevant subset.
- Payment links between vouchers and transactions are not exposed by any endpoint (`object[]` filter and CSV export both verified). Do not add lookups that pretend otherwise.
- `VoucherPos.accountDatev` is `null` for legacy bookkeeping-1.0 positions, which carry `accountingType` instead.
- Voucher save uses `POST /Voucher/Factory/saveVoucher` with `mapAll: true` and `voucherPosDelete: null`; file uploads go through `POST /Voucher/Factory/uploadTempFile` first.

## Testing

Vitest, no network. SDK tests build a resource on an `HttpClient` with a mocked `fetch` (`test/helpers.ts`: `createMockFetch`, `createHttpClient`, `lastRequest`) and assert on the exact request URL and JSON body. CLI tests import the command module directly, `vi.stubGlobal('fetch', …)`, mock `../src/interactive` and `../src/prompt`, and assert on requests plus `process.exit` behavior. Add tests alongside every new resource method and command.

## Releases

release-please with the `node-workspace` plugin; conventional commits drive versioning, and merging the release PR publishes to npm via OIDC trusted publishing. `save-exact=true` — all dependency versions are pinned, including the CLI's dependency on the SDK version (release-please bumps it). Changelogs are generated and excluded from prettier.
