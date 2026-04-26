import { describe, expect, it } from "vitest";

import { AssignmentUseCase } from "../apps/api/src/modules/assignment/application/use-cases/assignment.use-case.js";
import { AssignmentLoggerPort } from "../apps/api/src/modules/assignment/application/ports/assignment-logger.port.js";
import type { AssignmentLogEvent } from "../apps/api/src/modules/assignment/application/ports/assignment-logger.port.js";
import { AssignmentOutboxPort } from "../apps/api/src/modules/assignment/application/ports/assignment-outbox.port.js";
import type { AssignmentCreatedEvent } from "../apps/api/src/modules/assignment/application/ports/assignment-outbox.port.js";
import { InMemoryAssignmentRepository } from "../apps/api/src/modules/assignment/infrastructure/persistence/assignment.repository.js";
import { ConsoleAssignmentOutbox } from "../apps/api/src/modules/assignment/infrastructure/outbox/assignment.outbox.js";
import { InMemoryAssignmentTransaction } from "../apps/api/src/modules/assignment/infrastructure/transaction/assignment.transaction.js";
import { TransactionalAssignmentStore } from "../apps/api/src/modules/assignment/infrastructure/transaction/assignment.unit-of-work.js";

class FakeLogger extends AssignmentLoggerPort {
  readonly events: AssignmentLogEvent[] = [];

  async record(event: AssignmentLogEvent): Promise<void> {
    this.events.push(event);
  }
}

describe("TransactionalAssignmentStore", () => {
  it("commits assignment state and outbox records through the sample unit of work", async () => {
    const store = new TransactionalAssignmentStore();
    const repository = new InMemoryAssignmentRepository(store);
    const outbox = new ConsoleAssignmentOutbox(store);
    const transaction = new InMemoryAssignmentTransaction(store);
    const logger = new FakeLogger();
    const useCase = new AssignmentUseCase(repository, outbox, transaction, logger);

    await useCase.create({
      id: "assignment-2",
      assigneeId: "user-2",
      traceId: "trace-2",
      correlationId: "corr-2",
    });

    const persisted = await repository.findById("assignment-2");
    expect(persisted?.toSnapshot()).toMatchObject({
      id: "assignment-2",
      assigneeId: "user-2",
      status: "assigned",
    });
    expect(store.listOutbox()).toHaveLength(1);
    expect(store.listOutbox()[0]).toMatchObject({
      eventName: "assignment.created",
      eventVersion: "v1",
      aggregateId: "assignment-2",
      transactionId: "assignment.create:1",
    });
  });

  it("does not expose mutable outbox storage from the unit of work", async () => {
    const store = new TransactionalAssignmentStore();
    const leaked = store.listOutbox() as unknown as AssignmentCreatedEvent[];

    leaked.push({
      id: "assignment-leak",
      assigneeId: "user-leak",
      occurredAt: "2026-04-25T00:00:00.000Z",
    });

    expect(store.listOutbox()).toHaveLength(0);
  });

  it("rolls back assignment state when outbox append fails in the transaction", async () => {
    const store = new TransactionalAssignmentStore();
    const repository = new InMemoryAssignmentRepository(store);
    const transaction = new InMemoryAssignmentTransaction(store);
    const logger = new FakeLogger();
    const failingOutbox = new class extends AssignmentOutboxPort {
      async appendCreated(): Promise<void> {
        throw new Error("outbox unavailable");
      }
    }();
    const useCase = new AssignmentUseCase(repository, failingOutbox, transaction, logger);

    await expect(useCase.create({
      id: "assignment-rollback",
      assigneeId: "user-rollback",
      traceId: "trace-rollback",
      correlationId: "corr-rollback",
    })).rejects.toThrow("outbox unavailable");

    await expect(repository.findById("assignment-rollback")).resolves.toBeNull();
    expect(store.listOutbox()).toHaveLength(0);
    expect(logger.events.map((event) => event.outcome)).toEqual(["started", "failure"]);
  });
});
