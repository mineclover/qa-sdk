# Domain Slice Architecture Monorepo Sample

This sample proves the scaffold convention as a standalone monorepo template.
It is intentionally not included in the root `qa-sdk` workspace.

## Purpose

The sample shows a minimum production-oriented layout for:

- Domain Slice Architecture code boundaries.
- API and worker horizontal scaling boundaries.
- Shared API/event contracts.
- Infrastructure templates for local and Kubernetes-like deployment.
- OpenMetadata/cache-key seed placement near the owning domain slice.

## Workspace

```text
apps/
  api/                    # HTTP-facing command/query surface
  worker/                 # async projector/outbox consumer surface
packages/
  contracts/              # API/event contract package + OpenAPI merge input
  platform/               # runtime infra vocabulary and scaling profiles
infra/
  docker-compose.yml      # local infra template
  k8s/                    # deployment/HPA templates
docs/
  horizontal-scaling-guide.md
  source-architecture/      # raw architecture refs + current adaptation
```

## Domain Slice Layout

`apps/api/src/modules/assignment` is the reference slice:

```text
domain/                   # pure identity, state, invariant behavior
application/              # commands, ports, use cases
infrastructure/           # persistence and outbox adapters
presentation/http/        # input adapter
metadata/                 # OpenMetadata/cache-key seed
assignment.module.ts      # composition layout
```

## Verify

This sample avoids package installation. The verification script checks that the
template boundaries and scaling files exist.

```bash
node architecture-samples/domain-slice-monorepo/scripts/verify.mjs
node architecture-samples/domain-slice-monorepo/scripts/merge-openapi.mjs
node architecture-samples/domain-slice-monorepo/scripts/check-openapi.mjs
pnpm exec tsc -p architecture-samples/domain-slice-monorepo/tsconfig.base.json --noEmit
pnpm exec vitest run architecture-samples/domain-slice-monorepo/tests
```

## Promote OpenAPI Fragment

Scaffolded slices can emit a local domain fragment first. Promote it into the
central contracts package before merge/check:

```bash
qa-scaffold promote-openapi apps/api/src/modules/<domain>/contracts/openapi/domains/<domain>/spec.json --contracts-root packages/contracts
node scripts/merge-openapi.mjs
node scripts/check-openapi.mjs
```

## Source References

The original architecture notes are copied under
`docs/source-architecture/raw/`. The updated, implementation-oriented references
are under `docs/source-architecture/current/`.
