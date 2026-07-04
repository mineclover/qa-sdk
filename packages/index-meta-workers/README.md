# index-meta-workers

`index-meta-workers` is the Workers/Edge-compatible entry point for the `index-meta` runtime. It re-exports `index-meta/workers` and intentionally excludes Node.js-only drivers such as SQLite and `better-sqlite3`.

## Role

- Provide D1/Edge-safe index metadata primitives to Worker packages.
- Keep Node-specific imports out of the bundled output.
- Preserve the same public runtime shape consumed by Worker services.

## Consumers

- `packages/gate-service/src/worker.ts`
- `packages/decode-service/src/worker.ts`
- `packages/gate-service/src/services/consistency.ts`

## Verification

```bash
pnpm --filter index-meta-workers test
pnpm --filter index-meta-workers typecheck
```

`test` runs the package `validate` script, which builds the package and scans `dist/index.js` for known Node.js-only imports.
