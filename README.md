# sevdesk

[![CI](https://github.com/genz-its/sevdesk/actions/workflows/ci.yml/badge.svg)](https://github.com/genz-its/sevdesk/actions/workflows/ci.yml)
[![npm sdk](https://img.shields.io/npm/v/%40genz-its%2Fsevdesk-sdk?label=sdk)](https://www.npmjs.com/package/@genz-its/sevdesk-sdk)
[![npm cli](https://img.shields.io/npm/v/%40genz-its%2Fsevdesk-cli?label=cli)](https://www.npmjs.com/package/@genz-its/sevdesk-cli)
[![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

Unofficial Node.js SDK and CLI for the [sevdesk](https://sevdesk.de/) API.[^1]

## Packages

| Package                                    | Description                                    |
| ------------------------------------------ | ---------------------------------------------- |
| [`@genz-its/sevdesk-sdk`](./packages/sdk/) | Unofficial Node.js SDK for the sevdesk API.    |
| [`@genz-its/sevdesk-cli`](./packages/cli/) | Unofficial command-line interface for sevdesk. |

## Getting Started

```bash
# Use the SDK in your project
npm install @genz-its/sevdesk-sdk

# Or install the CLI globally
npm install -g @genz-its/sevdesk-cli
sevdesk login
```

See the [SDK documentation](./packages/sdk/README.md) and the [CLI documentation](./packages/cli/README.md) for usage details and the full command reference.

## Development

```bash
npm install
npm run build
npm run test
npm run lint
```

The [official OpenAPI specification](https://api.sevdesk.de/openapi.yaml) serves as a local development reference:

```bash
curl -fsSL https://api.sevdesk.de/openapi.yaml -o openapi.yaml
```

## License

See [LICENSE](./LICENSE).

[^1]: This project is not affiliated with, endorsed by, sponsored by, or approved by sevDesk GmbH or any of their affiliates or subsidiaries.
