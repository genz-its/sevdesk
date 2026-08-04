# sevdesk

Unofficial Node.js SDK and CLI for the [sevdesk](https://sevdesk.de/) API.[^1]

## Packages

| Package                                    | Description                                    |
| ------------------------------------------ | ---------------------------------------------- |
| [`@genz-its/sevdesk-sdk`](./packages/sdk/) | Unofficial Node.js SDK for the sevdesk API.    |
| [`@genz-its/sevdesk-cli`](./packages/cli/) | Unofficial command-line interface for sevdesk. |

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
