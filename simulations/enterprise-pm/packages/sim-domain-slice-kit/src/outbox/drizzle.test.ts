// @def.boundary sim-domain-slice-kit
// @def.doc domain-slice-architecture

import { describe, expect, it } from "vitest";
import { createDrizzleOutboxPort, type DrizzleInsertable } from "./drizzle.js";
import type { TransactionScope } from "../transaction.port.js";

describe("createDrizzleOutboxPort", () => {
  it("appends a row with the standard outbox shape", async () => {
    const calls: { table: unknown; row: Record<string, unknown> }[] = [];
    const fakeTable = { _: "outbox" };
    const db: DrizzleInsertable = {
      insert(table) {
        return {
          values(row) {
            calls.push({ table, row });
            return Promise.resolve(undefined);
          },
        };
      },
    };
    const port = createDrizzleOutboxPort({ db, table: fakeTable });
    const scope: TransactionScope = {
      id: "test:abc",
      startedAt: new Date(0),
    };
    const occurredAt = new Date(1_700_000_000_000);
    await port.append(
      {
        aggregateId: "agg-1",
        eventName: "AssignmentCreated",
        eventVersion: 1,
        payload: { foo: "bar" },
        occurredAt,
      },
      scope,
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]?.table).toBe(fakeTable);
    const row = calls[0]!.row;
    expect(typeof row.id).toBe("string");
    expect(row.aggregate_id).toBe("agg-1");
    expect(row.event_name).toBe("AssignmentCreated");
    expect(row.event_version).toBe(1);
    expect(row.payload).toBe(JSON.stringify({ foo: "bar" }));
    expect(row.occurred_at).toBe(occurredAt.getTime());
    expect(row.scope_id).toBe("test:abc");
    expect(row.status).toBe("pending");
  });

  it("supports builder.execute() pattern (drizzle >=1.0)", async () => {
    const executed: boolean[] = [];
    const db: DrizzleInsertable = {
      insert() {
        return {
          values() {
            return {
              execute: async () => {
                executed.push(true);
              },
            };
          },
        };
      },
    };
    const port = createDrizzleOutboxPort({ db, table: {} });
    await port.append(
      {
        aggregateId: "a",
        eventName: "E",
        eventVersion: 1,
        payload: {},
        occurredAt: new Date(),
      },
      { id: "s", startedAt: new Date() },
    );
    expect(executed).toEqual([true]);
  });

  it("uses custom serializer when provided", async () => {
    let captured: unknown;
    const db: DrizzleInsertable = {
      insert() {
        return {
          values(row) {
            captured = row.payload;
            return Promise.resolve(undefined);
          },
        };
      },
    };
    const port = createDrizzleOutboxPort({
      db,
      table: {},
      serializePayload: (p) => ({ wrapped: p }),
    });
    await port.append(
      {
        aggregateId: "a",
        eventName: "E",
        eventVersion: 1,
        payload: { x: 1 },
        occurredAt: new Date(),
      },
      { id: "s", startedAt: new Date() },
    );
    expect(captured).toEqual({ wrapped: { x: 1 } });
  });
});
