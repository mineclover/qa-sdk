import { describe, it, expect } from "vitest";
import { generateDataObjectBindings } from "./data-object-typescript.js";
import type { DataObjectBinding } from "@qa-sdk/core";

const SAMPLE_BINDINGS: DataObjectBinding[] = [
  {
    schemaId: "orders",
    schemaVersion: "v1",
    prefixId: "order_process",
    prefixVersion: "v1",
    columnToAxis: {
      orderType: { dimLabel: "orderType" },
      paymentMethod: { dimLabel: "paymentMethod", segmentId: "order_payment" },
    },
  },
  {
    schemaId: "members",
    schemaVersion: "v1",
    prefixId: "member_identity",
    prefixVersion: "v1",
    columnToAxis: {
      id: { dimLabel: "memberId" },
    },
  },
];

describe("generateDataObjectBindings", () => {
  it("3개 파일 생성", () => {
    const result = generateDataObjectBindings(SAMPLE_BINDINGS);
    expect(result.files).toHaveLength(3);
    expect(result.files.map(f => f.path).toSorted()).toEqual([
      "binding-registry.ts",
      "data-objects.ts",
      "lineage-types.ts",
    ]);
  });

  it("data-objects.ts — 바인딩 상수 + 타입 생성", () => {
    const result = generateDataObjectBindings(SAMPLE_BINDINGS);
    const content = result.files.find(f => f.path === "data-objects.ts")!.content;

    // 상수명: ORDERS_BINDING, MEMBERS_BINDING
    expect(content).toContain("ORDERS_BINDING");
    expect(content).toContain("MEMBERS_BINDING");
    // 타입명: OrdersBinding, MembersBinding
    expect(content).toContain("OrdersBinding");
    expect(content).toContain("MembersBinding");
    // segmentId 포함
    expect(content).toContain('segmentId: "order_payment"');
    // 자동 생성 주석
    expect(content).toContain("자동 생성");
  });

  it("binding-registry.ts — createBindingRegistry 함수 생성", () => {
    const result = generateDataObjectBindings(SAMPLE_BINDINGS);
    const content = result.files.find(f => f.path === "binding-registry.ts")!.content;

    expect(content).toContain("createBindingRegistry");
    expect(content).toContain("registry.register(MEMBERS_BINDING)");
    expect(content).toContain("registry.register(ORDERS_BINDING)");
  });

  it("lineage-types.ts — 유니온 타입 생성", () => {
    const result = generateDataObjectBindings(SAMPLE_BINDINGS);
    const content = result.files.find(f => f.path === "lineage-types.ts")!.content;

    expect(content).toContain('BoundSchemaId');
    expect(content).toContain('"orders"');
    expect(content).toContain('"members"');
    expect(content).toContain('BoundPrefixId');
    expect(content).toContain('OrdersColumns');
    expect(content).toContain('MembersColumns');
  });

  it("결정론성 — 같은 입력 → 같은 contentHash", () => {
    const r1 = generateDataObjectBindings(SAMPLE_BINDINGS);
    const r2 = generateDataObjectBindings(SAMPLE_BINDINGS);
    expect(r1.contentHash).toBe(r2.contentHash);
  });

  it("결정론성 — 순서 무관 같은 hash", () => {
    const r1 = generateDataObjectBindings(SAMPLE_BINDINGS);
    const r2 = generateDataObjectBindings([...SAMPLE_BINDINGS].toReversed());
    expect(r1.contentHash).toBe(r2.contentHash);
  });

  it("빈 바인딩 → 빈 유니온 타입 (never)", () => {
    const result = generateDataObjectBindings([]);
    const lineage = result.files.find(f => f.path === "lineage-types.ts")!.content;
    expect(lineage).toContain("never");
  });

  it("outDir 옵션 — 경로 접두사", () => {
    const result = generateDataObjectBindings(SAMPLE_BINDINGS, { outDir: "generated" });
    expect(result.files[0].path).toMatch(/^generated\//);
  });
});
