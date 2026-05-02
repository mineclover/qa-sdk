# Command and Query Contracts

## Source Mapping

This document adapts:

- `raw/Write-Model-및-Command-인터페이스-명세서.md`
- `raw/Read-Model-및-조회-인터페이스-명세서.md`
- `raw/표준-컨벤션-CQRS-데이터-흐름-다이어그램.md`

## Write Model

The write model owns business state transitions.

Required surfaces:

- command DTO or command schema
- use case method
- aggregate/entity behavior
- repository port
- outbox port when a domain event is required
- transaction boundary

The write model must not expose its entity shape as API response, OpenAPI schema,
read model row, or BFF view model.

## Command Interface

Command inputs are purpose-specific. Prefer:

```text
CreateAssignmentCommand
AssignManagerCommand
CancelAssignmentCommand
```

Avoid generic update DTOs for state transitions. If a command mutates business
state, it needs an explicit use case and test scenario.

## Query Surface

A query can be a direct query, read model, or BFF model. The shared distinction
between read model and BFF is defined in [README.md](README.md#read-model-vs-bff).

This document owns the contract rule: a query surface must have a named owner
and must not expose domain entity shape directly.

Use direct write-model lookup only for simple internal/admin cases. Use a read
model or BFF model when query shape, latency, or consumer ownership differs from
the write model.

## OpenAPI Contract

OpenAPI is a consumer contract, not a controller implementation dump.

- API schemas reference command/query DTOs, not domain entities.
- Domain-specific OpenAPI fragments live under `packages/contracts/openapi/domains/<domain>/spec.json`.
- Merged OpenAPI must be checked before considering a feature complete.
- Base document, deployment profile, common schemas, and domain fragments are
  separate inputs. This mirrors `~/workflow/oa-sdk` where `@oa-sdk/schemas`
  merges base/profile/domain specs with common-first domain ordering.
- Duplicate paths or component names fail the merge. This catches domain
  ownership collisions before code generation or BFF integration.

Reference contract:

- `packages/contracts/openapi/base.openapi.json`
- `packages/contracts/openapi/profiles/local.json`
- `packages/contracts/openapi/domains/common/spec.json`
- `packages/contracts/openapi/domains/assignment/spec.json`
- `scripts/merge-openapi.mjs`
- `scripts/check-openapi.mjs`
- scaffold-generated domains can emit a local fragment first, then promote it
  into the central `packages/contracts/openapi/domains/<domain>/spec.json`
  layout when the slice joins a shared API surface.
- `qa-scaffold promote-openapi <source> --contracts-root packages/contracts`
  is the standard promotion path. It refuses to overwrite an existing domain
  spec unless `--force` is passed.

## Cross-Domain Query

Use query ports or published read models. Do not deep import another domain's
repository, table schema, or entity.

Allowed:

- `AssignmentReadModelPort`
- `UserProfileQueryPort`
- event-driven read model projection

Disallowed:

- `../user/infrastructure/persistence/user.repository`
- direct foreign aggregate mutation
- presentation adapter calling another domain's infrastructure adapter

## Cross-Domain Write Preconditions

When domain B writes based on domain A state, B must treat A state as a
precondition contract. A stale read model must not silently drive B's write.

Required shape:

```text
CreateBillingCommand
  assignmentId
  requiredAssignmentVersion

CreateBillingUseCase
  -> AssignmentStateQueryPort.findById(assignmentId)
  -> reject if observed version < required version
  -> reject if observed status is not billable
  -> write Billing aggregate
```

Reference scenario:

- `docs/scenarios/cross-domain-precondition-billing.md`
- `apps/api/src/modules/billing/application/ports/assignment-state.query-port.ts`
- `apps/api/src/modules/billing/application/use-cases/create-billing.use-case.ts`
- `tests/billing-cross-domain-precondition.test.ts`

Use `PRECONDITION_NOT_READY` style named exceptions for retry/delay cases and
business named exceptions for current-but-invalid states.
