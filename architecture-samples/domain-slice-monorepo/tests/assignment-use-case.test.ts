import { describe, expect, it } from "vitest";

import { AssignmentUseCase } from "../apps/api/src/modules/assignment/application/use-cases/assignment.use-case.js";
import { AssignmentLoggerPort } from "../apps/api/src/modules/assignment/application/ports/assignment-logger.port.js";
import type { AssignmentLogEvent } from "../apps/api/src/modules/assignment/application/ports/assignment-logger.port.js";
import { AssignmentOutboxPort } from "../apps/api/src/modules/assignment/application/ports/assignment-outbox.port.js";
import type { AssignmentCreatedEvent } from "../apps/api/src/modules/assignment/application/ports/assignment-outbox.port.js";
import { AssignmentRepositoryPort } from "../apps/api/src/modules/assignment/application/ports/assignment-repository.port.js";
import { AssignmentTransactionPort } from "../apps/api/src/modules/assignment/application/ports/assignment-transaction.port.js";
import type { AssignmentTransactionScope } from "../apps/api/src/modules/assignment/application/ports/assignment-transaction.port.js";
import type { AssignmentEntity } from "../apps/api/src/modules/assignment/domain/index.js";

class FakeRepository extends AssignmentRepositoryPort {
  readonly saved: Array<{ entity: AssignmentEntity; scope?: AssignmentTransactionScope }> = [];

  async save(entity: AssignmentEntity, scope?: AssignmentTransactionScope): Promise<void> {
    this.saved.push({ entity, scope });
  }

  async findById(): Promise<AssignmentEntity | null> {
    return null;
  }
}

class FakeOutbox extends AssignmentOutboxPort {
  readonly events: Array<{ event: AssignmentCreatedEvent; scope?: AssignmentTransactionScope }> = [];

  async appendCreated(event: AssignmentCreatedEvent, scope?: AssignmentTransactionScope): Promise<void> {
    this.events.push({ event, scope });
  }
}

class FakeTransaction extends AssignmentTransactionPort {
  readonly scope: AssignmentTransactionScope = { id: "assignment.create:1", name: "assignment.create" };

  async run<T>(_name: string, handler: (scope: AssignmentTransactionScope) => Promise<T>): Promise<T> {
    return handler(this.scope);
  }
}

class FakeLogger extends AssignmentLoggerPort {
  readonly events: AssignmentLogEvent[] = [];

  async record(event: AssignmentLogEvent): Promise<void> {
    this.events.push(event);
  }
}

describe("AssignmentUseCase", () => {
  it("runs write model save and outbox append in the same transaction scope and records logs", async () => {
    const repository = new FakeRepository();
    const outbox = new FakeOutbox();
    const transaction = new FakeTransaction();
    const logger = new FakeLogger();
    const useCase = new AssignmentUseCase(repository, outbox, transaction, logger);

    await useCase.create({
      id: "assignment-1",
      assigneeId: "user-1",
      traceId: "trace-1",
      correlationId: "corr-1",
    });

    expect(repository.saved).toHaveLength(1);
    expect(outbox.events).toHaveLength(1);
    expect(repository.saved[0]?.scope).toEqual(transaction.scope);
    expect(outbox.events[0]?.scope).toEqual(transaction.scope);
    expect(outbox.events[0]?.event).toMatchObject({
      id: "assignment-1",
      assigneeId: "user-1",
    });
    expect(logger.events.map((event) => event.outcome)).toEqual(["started", "success"]);
    expect(logger.events[1]).toMatchObject({
      eventName: "assignment.created",
      eventVersion: "v1",
    });
  });
});
