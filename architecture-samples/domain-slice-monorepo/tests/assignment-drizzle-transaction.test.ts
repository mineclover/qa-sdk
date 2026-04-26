import { describe, expect, it } from "vitest";

import {
  DrizzleAssignmentTransaction,
  type AssignmentDrizzleDb,
  type AssignmentDrizzleTransactionClient,
} from "../apps/api/src/modules/assignment/infrastructure/transaction/assignment.drizzle-transaction.js";
import { TransactionalAssignmentStore } from "../apps/api/src/modules/assignment/infrastructure/transaction/assignment.unit-of-work.js";

class FakeDrizzleDb implements AssignmentDrizzleDb {
  readonly tx: AssignmentDrizzleTransactionClient = { id: "tx-1" };
  readonly calls: string[] = [];

  async transaction<T>(handler: (tx: AssignmentDrizzleTransactionClient) => Promise<T>): Promise<T> {
    this.calls.push("begin");
    try {
      const result = await handler(this.tx);
      this.calls.push("commit");
      return result;
    } catch (error) {
      this.calls.push("rollback");
      throw error;
    }
  }
}

describe("DrizzleAssignmentTransaction", () => {
  it("maps use case transaction scope to a database transaction client", async () => {
    const store = new TransactionalAssignmentStore();
    const db = new FakeDrizzleDb();
    const transaction = new DrizzleAssignmentTransaction(store, db);

    await transaction.run("assignment.create", async (scope) => {
      expect(scope).toMatchObject({
        id: "assignment.create:1",
        name: "assignment.create",
        tx: db.tx,
      });
      scope.pendingOutbox.push({
        id: "assignment.created:assignment-1:assignment.create:1",
        eventName: "assignment.created",
        eventVersion: "v1",
        aggregateId: "assignment-1",
        payload: {
          id: "assignment-1",
          assigneeId: "user-1",
          occurredAt: "2026-04-25T00:00:00.000Z",
        },
        transactionId: scope.id,
      });
    });

    expect(db.calls).toEqual(["begin", "commit"]);
    expect(store.listOutbox()).toHaveLength(1);
  });

  it("does not commit staged outbox records when the database transaction rolls back", async () => {
    const store = new TransactionalAssignmentStore();
    const db = new FakeDrizzleDb();
    const transaction = new DrizzleAssignmentTransaction(store, db);

    await expect(transaction.run("assignment.create", async (scope) => {
      scope.pendingOutbox.push({
        id: "assignment.created:assignment-rollback:assignment.create:1",
        eventName: "assignment.created",
        eventVersion: "v1",
        aggregateId: "assignment-rollback",
        payload: {
          id: "assignment-rollback",
          assigneeId: "user-rollback",
          occurredAt: "2026-04-25T00:00:00.000Z",
        },
        transactionId: scope.id,
      });
      throw new Error("db unavailable");
    })).rejects.toThrow("db unavailable");

    expect(db.calls).toEqual(["begin", "rollback"]);
    expect(store.listOutbox()).toHaveLength(0);
  });
});
