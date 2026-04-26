# Scenario: Assignment Create and BFF Detail

## Purpose

Validate the minimum Domain Slice Architecture path across write model,
transaction boundary, outbox event, logging, read model, BFF composition, and
cache metadata.

## Traceability

Use cases:

- `apps/api/src/modules/assignment/application/use-cases/assignment.use-case.ts#AssignmentUseCase.create`
- `apps/api/src/modules/assignment/presentation/bff/assignment-detail.bff.ts#AssignmentDetailBff.getDetail`
- `apps/worker/src/projectors/assignment-read-model.projector.ts#AssignmentReadModelProjector.applyCreated`

Tests:

- `tests/assignment-use-case.test.ts`
- `tests/assignment-unit-of-work.test.ts`
- `tests/assignment-bff.test.ts`
- `tests/assignment-projector.test.ts`
- `tests/assignment-drizzle-transaction.test.ts`

Contracts:

- `packages/contracts/openapi/domains/assignment/spec.json`
- `apps/api/src/modules/assignment/metadata/openmetadata.seed.json`

## Given

- no assignment exists for `assignment-1`
- assignment metadata defines `assignment-read-model` and `assignment-bff-detail`
- API module wires repository, outbox, transaction, logger, read model, HTTP, and BFF adapters

## When

1. `AssignmentController.create` receives `CreateAssignmentCommand`.
2. `AssignmentUseCase.create` runs `assignment.create` transaction.
3. The use case saves the aggregate and appends `assignment.created`.
4. `AssignmentDetailBff.getDetail` reads the detail view.
5. `AssignmentReadModelProjector.applyCreated` consumes the event contract in the worker boundary.

## Then

- repository stores the assigned aggregate snapshot
- outbox receives `assignment.created`
- repository state and outbox record are committed through one unit of work
- if outbox append fails, assignment state is not committed
- logger records `started` and `success` write flow events
- BFF returns a UI-facing model, not `AssignmentEntity`
- BFF response includes `assignment-bff-detail:v1:<id>` cache key
- merged OpenAPI contains `/assignments`, `/bff/assignments/{id}`, common
  `ErrorResponse`, and local profile server without exposing `AssignmentEntity`
