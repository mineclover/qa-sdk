// @def.boundary persistence-system-root
// @def.doc persistence-system-root

import { beforeEach, describe, expect, it } from "vitest";
import type { DataObjectBinding } from "@qa-sdk/core";

import {
  SqliteBindingStore,
  SqliteLineageValidationStore,
  type LineageValidationDetail,
} from "./data-object-store.js";

function makeBinding(overrides: Partial<DataObjectBinding> = {}): DataObjectBinding {
  return {
    schemaId: "orders",
    schemaVersion: "v1",
    prefixId: "order_route",
    prefixVersion: "v1",
    columnToAxis: {
      id: { dimLabel: "orderId" },
      payment_method: { dimLabel: "paymentMethod", segmentId: "order_payment" },
    },
    ...overrides,
  };
}

function makeDetails(status: LineageValidationDetail["status"]): LineageValidationDetail[] {
  return [
    {
      status,
      target: { schemaId: "orders", column: "payment_method" },
      sources: [{ schemaId: "raw_orders", column: "payment_method" }],
      pipeId: "orders-sync",
      stepPath: "normalize.payment",
      reason: status === "bound" ? undefined : `${status} detected`,
    },
  ];
}

describe("SqliteBindingStore", () => {
  let store: SqliteBindingStore;

  beforeEach(() => {
    store = new SqliteBindingStore(":memory:");
  });

  it("save + get으로 binding snapshot을 저장/조회한다", () => {
    store.save(makeBinding());

    const loaded = store.get("orders");
    expect(loaded).toEqual({
      schemaId: "orders",
      prefixId: "order_route",
      prefixVersion: "v1",
      columnToAxis: {
        id: { dimLabel: "orderId" },
        payment_method: { dimLabel: "paymentMethod", segmentId: "order_payment" },
      },
      createdAt: expect.any(String),
    });
  });

  it("같은 schemaId save는 upsert되고 createdAt은 유지된다", () => {
    const first = store.save(makeBinding());
    const updated = store.save(
      makeBinding({
        prefixId: "order_facts",
        prefixVersion: "v2",
        columnToAxis: {
          id: { dimLabel: "orderId" },
        },
      }),
    );

    expect(updated.createdAt).toBe(first.createdAt);
    expect(store.get("orders")).toEqual({
      schemaId: "orders",
      prefixId: "order_facts",
      prefixVersion: "v2",
      columnToAxis: {
        id: { dimLabel: "orderId" },
      },
      createdAt: first.createdAt,
    });
  });

  it("list + remove", () => {
    store.save(makeBinding({ schemaId: "orders" }));
    store.save(makeBinding({ schemaId: "members", prefixId: "member_identity" }));

    expect(store.list().map((binding) => binding.schemaId)).toEqual(["members", "orders"]);
    expect(store.remove("orders")).toBe(true);
    expect(store.get("orders")).toBeNull();
    expect(store.remove("orders")).toBe(false);
  });
});

describe("SqliteLineageValidationStore", () => {
  let store: SqliteLineageValidationStore;

  beforeEach(() => {
    store = new SqliteLineageValidationStore(":memory:");
  });

  it("save + getLatest로 최신 검증 결과를 저장/조회한다", () => {
    const saved = store.save({
      schemaId: "orders",
      validatedAt: "2026-04-02T00:00:00.000Z",
      bound: 3,
      unbound: 1,
      mismatched: 0,
      details: makeDetails("unbound"),
    });

    expect(saved.id).toEqual(expect.any(String));
    expect(store.getLatest("orders")).toEqual({
      id: saved.id,
      schemaId: "orders",
      validatedAt: "2026-04-02T00:00:00.000Z",
      bound: 3,
      unbound: 1,
      mismatched: 0,
      details: makeDetails("unbound"),
    });
  });

  it("listBySchema는 schema별 이력을 최신순으로 반환한다", () => {
    store.save({
      schemaId: "orders",
      validatedAt: "2026-04-02T00:00:00.000Z",
      bound: 1,
      unbound: 0,
      mismatched: 0,
      details: makeDetails("bound"),
    });
    store.save({
      schemaId: "orders",
      validatedAt: "2026-04-02T01:00:00.000Z",
      bound: 0,
      unbound: 0,
      mismatched: 1,
      details: makeDetails("mismatched"),
    });
    store.save({
      schemaId: "members",
      validatedAt: "2026-04-02T02:00:00.000Z",
      bound: 2,
      unbound: 0,
      mismatched: 0,
      details: makeDetails("bound"),
    });

    const records = store.listBySchema("orders");
    expect(records).toHaveLength(2);
    expect(records.map((record) => record.validatedAt)).toEqual([
      "2026-04-02T01:00:00.000Z",
      "2026-04-02T00:00:00.000Z",
    ]);
    expect(store.getLatest("members")?.bound).toBe(2);
  });

  it("없는 schemaId 조회는 null/빈 배열을 반환한다", () => {
    expect(store.getLatest("missing")).toBeNull();
    expect(store.listBySchema("missing")).toEqual([]);
  });
});
