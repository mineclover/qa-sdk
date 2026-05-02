import { describe, expect, it } from "vitest";

import { CreateBillingUseCase } from "../apps/api/src/modules/billing/application/use-cases/create-billing.use-case.js";
import { AssignmentStateQueryPort } from "../apps/api/src/modules/billing/application/ports/assignment-state.query-port.js";
import type { AssignmentStateView } from "../apps/api/src/modules/billing/application/ports/assignment-state.query-port.js";
import { BillingRepositoryPort } from "../apps/api/src/modules/billing/application/ports/billing-repository.port.js";
import { BillingLoggerPort, type BillingLogEvent } from "../apps/api/src/modules/billing/application/ports/billing-logger.port.js";
import { BillingTransactionPort, type BillingTransactionScope } from "../apps/api/src/modules/billing/application/ports/billing-transaction.port.js";
import type { BillingEntity } from "../apps/api/src/modules/billing/domain/index.js";
import {
  AssignmentNotBillableException,
  AssignmentPreconditionNotReadyException,
} from "../apps/api/src/modules/billing/domain/index.js";

class FakeAssignmentStateQuery extends AssignmentStateQueryPort {
  constructor(private readonly view: AssignmentStateView | null) {
    super();
  }

  async findById(): Promise<AssignmentStateView | null> {
    return this.view;
  }
}

class FakeBillingRepository extends BillingRepositoryPort {
  readonly saved: Array<{ entity: BillingEntity; scope?: BillingTransactionScope }> = [];

  async save(entity: BillingEntity, scope?: BillingTransactionScope): Promise<void> {
    this.saved.push({ entity, scope });
  }
}

class FakeBillingTransaction extends BillingTransactionPort {
  readonly scope: BillingTransactionScope = { id: "billing.create:1", name: "billing.create" };

  async run<T>(_name: string, handler: (scope: BillingTransactionScope) => Promise<T>): Promise<T> {
    return handler(this.scope);
  }
}

class FakeBillingLogger extends BillingLoggerPort {
  readonly events: BillingLogEvent[] = [];

  async record(event: BillingLogEvent): Promise<void> {
    this.events.push(event);
  }
}

function createUseCase(view: AssignmentStateView | null, repository = new FakeBillingRepository()) {
  const transaction = new FakeBillingTransaction();
  const logger = new FakeBillingLogger();
  return {
    logger,
    repository,
    transaction,
    useCase: new CreateBillingUseCase(new FakeAssignmentStateQuery(view), repository, transaction, logger),
  };
}

describe("CreateBillingUseCase cross-domain precondition", () => {
  it("delays B write when A read model has not reached the required version", async () => {
    const { logger, repository, useCase } = createUseCase({ id: "assignment-1", status: "assigned", version: 2 });

    await expect(useCase.create({
      id: "billing-1",
      assignmentId: "assignment-1",
      requiredAssignmentVersion: 3,
    })).rejects.toThrow(AssignmentPreconditionNotReadyException);
    expect(repository.saved).toHaveLength(0);
    expect(logger.events.map((event) => event.outcome)).toEqual(["started", "failure"]);
  });

  it("rejects B write when A state is current but not billable", async () => {
    const { logger, repository, useCase } = createUseCase({ id: "assignment-1", status: "cancelled", version: 3 });

    await expect(useCase.create({
      id: "billing-1",
      assignmentId: "assignment-1",
      requiredAssignmentVersion: 3,
    })).rejects.toThrow(AssignmentNotBillableException);
    expect(repository.saved).toHaveLength(0);
    expect(logger.events.map((event) => event.outcome)).toEqual(["started", "failure"]);
  });

  it("creates B write when A state is current and billable", async () => {
    const { logger, repository, transaction, useCase } = createUseCase({ id: "assignment-1", status: "assigned", version: 3 });

    await useCase.create({
      id: "billing-1",
      assignmentId: "assignment-1",
      requiredAssignmentVersion: 3,
    });

    expect(repository.saved[0]?.entity.toSnapshot()).toMatchObject({
      id: "billing-1",
      assignmentId: "assignment-1",
      assignmentVersion: 3,
      status: "created",
    });
    expect(repository.saved[0]?.scope).toEqual(transaction.scope);
    expect(logger.events.map((event) => event.outcome)).toEqual(["started", "success"]);
  });
});
