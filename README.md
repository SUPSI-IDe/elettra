# elettra

## Tests

Pure unit tests run without network access:

```bash
npm test
```

The browser source suite uses Vite on port `9010` only to serve local modules.
Its API proxy is fixed to the staging backend on port `9005`; it refuses
production port `8002` and does not reuse an existing Vite server with unknown
proxy settings:

```bash
npm run test:e2e
```

The staging smoke suite verifies the deployed chain explicitly:

- frontend: `http://127.0.0.1:55558`;
- backend: `http://127.0.0.1:9005`;
- PostgreSQL: `127.0.0.1:9004`.

```bash
npm run test:staging
```
