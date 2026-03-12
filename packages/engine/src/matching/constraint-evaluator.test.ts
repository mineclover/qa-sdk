import { describe, expect, it } from "vitest";
import { evaluateConstraint, evaluateConstraints } from "./constraint-evaluator.js";
import type { RuntimeNode, StepConstraint } from "@qa-sdk/core";

function buildNode(overrides: Partial<RuntimeNode> = {}): RuntimeNode {
  return {
    id: "node_1",
    log_id: "log_1",
    timestamp: "2026-03-12T10:00:00.000Z",
    record_kind: "log",
    event_key: "checkout.save",
    event_version: "001",
    payload: {},
    payload_masking_applied: false,
    payload_masked_fields: [],
    ...overrides,
  };
}

describe("evaluateConstraint", () => {
  // ── eq ──

  it("eq: returns true when payload field matches", () => {
    const node = buildNode({ payload: { status: "completed" } });
    expect(evaluateConstraint({ field: "payload.status", op: "eq", value: "completed" }, node)).toBe(true);
  });

  it("eq: returns false when payload field differs", () => {
    const node = buildNode({ payload: { status: "pending" } });
    expect(evaluateConstraint({ field: "payload.status", op: "eq", value: "completed" }, node)).toBe(false);
  });

  it("eq: matches direct node field", () => {
    const node = buildNode({ event_key: "order.placed" });
    expect(evaluateConstraint({ field: "event_key", op: "eq", value: "order.placed" }, node)).toBe(true);
  });

  // ── neq ──

  it("neq: returns true when values differ", () => {
    const node = buildNode({ payload: { status: "pending" } });
    expect(evaluateConstraint({ field: "payload.status", op: "neq", value: "completed" }, node)).toBe(true);
  });

  it("neq: returns false when values match", () => {
    const node = buildNode({ payload: { status: "completed" } });
    expect(evaluateConstraint({ field: "payload.status", op: "neq", value: "completed" }, node)).toBe(false);
  });

  // ── exists ──

  it("exists: returns true when field is present", () => {
    const node = buildNode({ payload: { orderId: "ord_1" } });
    expect(evaluateConstraint({ field: "payload.orderId", op: "exists" }, node)).toBe(true);
  });

  it("exists: returns false when field is undefined", () => {
    const node = buildNode({ payload: {} });
    expect(evaluateConstraint({ field: "payload.orderId", op: "exists" }, node)).toBe(false);
  });

  it("exists: returns false when field is null", () => {
    const node = buildNode({ payload: { orderId: null } });
    expect(evaluateConstraint({ field: "payload.orderId", op: "exists" }, node)).toBe(false);
  });

  // ── gt / lt ──

  it("gt: returns true when value is greater", () => {
    const node = buildNode({ payload: { amount: 150 } });
    expect(evaluateConstraint({ field: "payload.amount", op: "gt", value: 100 }, node)).toBe(true);
  });

  it("gt: returns false when value is equal", () => {
    const node = buildNode({ payload: { amount: 100 } });
    expect(evaluateConstraint({ field: "payload.amount", op: "gt", value: 100 }, node)).toBe(false);
  });

  it("gt: returns false when value is not a number", () => {
    const node = buildNode({ payload: { amount: "high" } });
    expect(evaluateConstraint({ field: "payload.amount", op: "gt", value: 100 }, node)).toBe(false);
  });

  it("lt: returns true when value is less", () => {
    const node = buildNode({ payload: { latency: 50 } });
    expect(evaluateConstraint({ field: "payload.latency", op: "lt", value: 100 }, node)).toBe(true);
  });

  it("lt: returns false when value is greater", () => {
    const node = buildNode({ payload: { latency: 200 } });
    expect(evaluateConstraint({ field: "payload.latency", op: "lt", value: 100 }, node)).toBe(false);
  });

  // ── contains ──

  it("contains: returns true when string includes substring", () => {
    const node = buildNode({ payload: { message: "order confirmed successfully" } });
    expect(evaluateConstraint({ field: "payload.message", op: "contains", value: "confirmed" }, node)).toBe(true);
  });

  it("contains: returns false when substring not found", () => {
    const node = buildNode({ payload: { message: "order pending" } });
    expect(evaluateConstraint({ field: "payload.message", op: "contains", value: "confirmed" }, node)).toBe(false);
  });

  it("contains: returns false when value is not string", () => {
    const node = buildNode({ payload: { count: 42 } });
    expect(evaluateConstraint({ field: "payload.count", op: "contains", value: "4" }, node)).toBe(false);
  });

  // ── masked ──

  it("masked: returns true when field is in masked list", () => {
    const node = buildNode({
      payload: { email: "***" },
      payload_masked_fields: ["email"],
    });
    expect(evaluateConstraint({ field: "payload.email", op: "masked" }, node)).toBe(true);
  });

  it("masked: returns false when field is not masked", () => {
    const node = buildNode({
      payload: { email: "user@example.com" },
      payload_masked_fields: [],
    });
    expect(evaluateConstraint({ field: "payload.email", op: "masked" }, node)).toBe(false);
  });

  it("masked: strips payload. prefix when checking masked fields", () => {
    const node = buildNode({
      payload_masked_fields: ["ssn"],
    });
    expect(evaluateConstraint({ field: "payload.ssn", op: "masked" }, node)).toBe(true);
  });

  // ── unknown op ──

  it("returns false for unknown operator", () => {
    const node = buildNode();
    expect(evaluateConstraint({ field: "payload.x", op: "regex" as StepConstraint["op"] }, node)).toBe(false);
  });

  // ── field resolution ──

  it("resolves payload.nested field correctly", () => {
    const node = buildNode({ payload: { nested: { deep: "value" } } });
    // resolveField only goes one level into payload
    expect(evaluateConstraint({ field: "payload.nested", op: "exists" }, node)).toBe(true);
  });

  it("returns undefined for missing payload key", () => {
    const node = buildNode({ payload: { a: 1 } });
    expect(evaluateConstraint({ field: "payload.missing", op: "exists" }, node)).toBe(false);
  });

  it("handles null payload gracefully", () => {
    const node = buildNode({ payload: null });
    expect(evaluateConstraint({ field: "payload.x", op: "exists" }, node)).toBe(false);
  });
});

describe("evaluateConstraints", () => {
  it("returns per-constraint pass results when all constraints pass", () => {
    const node = buildNode({ payload: { status: "done", count: 5 } });
    const constraints: StepConstraint[] = [
      { field: "payload.status", op: "eq", value: "done" },
      { field: "payload.count", op: "gt", value: 0 },
    ];
    expect(evaluateConstraints(constraints, node)).toEqual([
      {
        constraint: constraints[0],
        passed: true,
        actual: "done",
      },
      {
        constraint: constraints[1],
        passed: true,
        actual: 5,
      },
    ]);
  });

  it("returns per-constraint failures when any constraint fails", () => {
    const node = buildNode({ payload: { status: "done", count: 0 } });
    const constraints: StepConstraint[] = [
      { field: "payload.status", op: "eq", value: "done" },
      { field: "payload.count", op: "gt", value: 0 },
    ];
    expect(evaluateConstraints(constraints, node)).toEqual([
      {
        constraint: constraints[0],
        passed: true,
        actual: "done",
      },
      {
        constraint: constraints[1],
        passed: false,
        actual: 0,
      },
    ]);
  });

  it("returns an empty result array for empty constraints", () => {
    const node = buildNode();
    expect(evaluateConstraints([], node)).toEqual([]);
  });
});
