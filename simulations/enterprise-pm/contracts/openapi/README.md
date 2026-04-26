# Enterprise PM OpenAPI Contracts

This directory is an `oa-sdk`-compatible contract workspace for architecture simulation.

It mirrors the layout used by `/Users/junwoobang/workflow/oa-sdk/packages/schemas`:

```text
src/
  openapi.yaml
  profiles/local.yaml
  domains/common/spec.yaml
  domains/assignment/spec.yaml
```

Intended use:

1. Author domain API fragments here while implementing simulation slices.
2. Run the local compatibility check:

```bash
pnpm --filter @qa-sdk-sim/enterprise-pm contracts:openapi:check
```

3. Copy or sync the `src/` tree into an `oa-sdk` schema workspace.
4. Run the oa-sdk merge/validation gate:

```bash
cd /Users/junwoobang/workflow/oa-sdk/packages/schemas
pnpm merge
pnpm validate
```

The merge gate rejects duplicate paths and duplicate component names unless explicitly allowed, so it is suitable as an API-contract collision check for modular domain teams.
