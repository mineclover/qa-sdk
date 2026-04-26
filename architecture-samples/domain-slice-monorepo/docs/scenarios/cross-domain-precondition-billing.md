# Scenario: Cross-Domain Precondition for Billing

## Purpose

Validate the case where domain B writes only after observing domain A at a
required version. This prevents stale read models from silently driving a write.

## Traceability

Use cases:

- `apps/api/src/modules/billing/application/use-cases/create-billing.use-case.ts#CreateBillingUseCase.create`
- `apps/api/src/modules/billing/application/ports/assignment-state.query-port.ts#AssignmentStateQueryPort.findById`

Tests:

- `tests/billing-cross-domain-precondition.test.ts`

Contracts:

- `apps/api/src/modules/billing/application/commands/create-billing.command.ts`
- `apps/api/src/modules/billing/application/ports/assignment-state.query-port.ts`

## Given

- Assignment owns assignment status.
- Billing owns billing creation.
- Billing cannot directly read Assignment persistence or mutate Assignment.
- Billing receives `requiredAssignmentVersion` from the caller or process manager.

## When

1. Assignment write emits or exposes version `3`.
2. Billing create reads Assignment through `AssignmentStateQueryPort`.
3. Billing compares observed version with `requiredAssignmentVersion`.

## Then

- if Assignment is missing or version is lower than required, Billing returns
  `ASSIGNMENT_PRECONDITION_NOT_READY`
- if Assignment is current but not `assigned`, Billing returns
  `ASSIGNMENT_NOT_BILLABLE`
- if Assignment is current and `assigned`, Billing writes its own aggregate

## Rule

B write must not trust a stale A read model when A state is part of B's
invariant. Use a query port, local projection with version check, or saga retry
instead of direct cross-domain persistence access.
