// @def.doc meta-semantic-v2-migration
import { describe, it, expect } from "vitest";
import { convertScenarioToPipeGraph } from "./scenario-to-pipe.js";
import type { ScenarioSpec, PipeOptional, PipeStep } from "@qa-sdk/core";

const base: ScenarioSpec = {
  scenario_id: "order-flow",
  version: "v1",
  domain: "commerce",
  steps: [],
};

describe("convertScenarioToPipeGraph", () => {
  it("빈 steps → 빈 그래프", () => {
    const g = convertScenarioToPipeGraph(base);
    expect(g.graphId).toBe("order-flow");
    expect(g.version).toBe("v1");
    expect(g.pipes).toHaveLength(0);
    expect(g.connections).toHaveLength(0);
    expect(g.entryPipeId).toBe("");
  });

  it("단일 step → 파이프 1개, 연결 없음", () => {
    const spec: ScenarioSpec = {
      ...base,
      steps: [{ id: "s1", event_key: "order_created", required: true, kind: "sequence" }],
    };
    const g = convertScenarioToPipeGraph(spec);
    expect(g.pipes).toHaveLength(1);
    expect(g.connections).toHaveLength(0);
    expect(g.entryPipeId).toBe("s1");
    expect(g.pipes[0].pipeId).toBe("s1");
    expect(g.pipes[0].trigger.eventKey).toBe("order_created");
  });

  it("sequence steps → 순차 연결 자동 생성", () => {
    const spec: ScenarioSpec = {
      ...base,
      steps: [
        { id: "s1", event_key: "order_created", required: true, kind: "sequence" },
        { id: "s2", event_key: "payment_requested", required: true, kind: "sequence" },
        { id: "s3", event_key: "payment_completed", required: true, kind: "sequence" },
      ],
    };
    const g = convertScenarioToPipeGraph(spec);
    expect(g.connections).toHaveLength(2);
    expect(g.connections[0]).toEqual({ from: "s1", to: "s2", kind: "next" });
    expect(g.connections[1]).toEqual({ from: "s2", to: "s3", kind: "next" });
  });

  it("optional step → PipeOptional 래퍼", () => {
    const spec: ScenarioSpec = {
      ...base,
      steps: [
        { id: "s1", event_key: "order_created", required: true, kind: "sequence" },
        { id: "s2", event_key: "coupon_applied", required: false, kind: "optional" },
      ],
    };
    const g = convertScenarioToPipeGraph(spec);
    const flow = g.pipes[1].flow as PipeOptional;
    expect(flow.kind).toBe("optional");
    expect((flow.step as PipeStep).kind).toBe("step");
    expect((flow.step as PipeStep).eventKey).toBe("coupon_applied");
  });

  it("entry_conditions → 첫 번째 파이프 trigger.entryConditions", () => {
    const spec: ScenarioSpec = {
      ...base,
      entry_conditions: [{ field: "env", op: "eq", value: "production" }],
      steps: [
        { id: "s1", event_key: "order_created", required: true, kind: "sequence" },
        { id: "s2", event_key: "payment_requested", required: true, kind: "sequence" },
      ],
    };
    const g = convertScenarioToPipeGraph(spec);
    expect(g.pipes[0].trigger.entryConditions).toHaveLength(1);
    expect(g.pipes[0].trigger.entryConditions![0]).toEqual({ field: "env", op: "eq", value: "production" });
    expect(g.pipes[1].trigger.entryConditions).toBeUndefined();
  });

  it("constraints 변환", () => {
    const spec: ScenarioSpec = {
      ...base,
      steps: [
        {
          id: "s1",
          event_key: "order_created",
          required: true,
          kind: "sequence",
          constraints: [{ field: "amount", op: "gt", value: 0 }],
        },
      ],
    };
    const g = convertScenarioToPipeGraph(spec);
    const flow = g.pipes[0].flow as PipeStep;
    expect(flow.constraints).toHaveLength(1);
    expect(flow.constraints![0]).toEqual({ field: "amount", op: "gt", value: 0 });
  });

  it("timeout_ms → PipeStep timeout", () => {
    const spec: ScenarioSpec = {
      ...base,
      steps: [{ id: "s1", event_key: "payment_requested", required: true, kind: "sequence", timeout_ms: 5000 }],
    };
    const g = convertScenarioToPipeGraph(spec);
    expect((g.pipes[0].flow as PipeStep).timeout).toBe(5000);
  });

  it("explicit next links → explicit connections (1:1)", () => {
    const spec: ScenarioSpec = {
      ...base,
      steps: [
        { id: "s1", event_key: "order_created", required: true, kind: "sequence", next: ["s2"] },
        { id: "s2", event_key: "payment_requested", required: true, kind: "sequence" },
      ],
    };
    const g = convertScenarioToPipeGraph(spec);
    expect(g.connections).toHaveLength(1);
    expect(g.connections[0]).toEqual({ from: "s1", to: "s2", kind: "next" });
  });

  it("explicit next links → explicit connections (1:N)", () => {
    const spec: ScenarioSpec = {
      ...base,
      steps: [
        { id: "s1", event_key: "order_created", required: true, kind: "sequence", next: ["s2", "s3"] },
        { id: "s2", event_key: "payment_requested", required: true, kind: "sequence" },
        { id: "s3", event_key: "notification_sent", required: false, kind: "optional" },
      ],
    };
    const g = convertScenarioToPipeGraph(spec);
    expect(g.connections).toHaveLength(1);
    expect(g.connections[0]).toEqual({ from: "s1", to: ["s2", "s3"], kind: "next" });
  });

  it("branch → conditional connections", () => {
    const spec: ScenarioSpec = {
      ...base,
      steps: [
        {
          id: "s1",
          event_key: "payment_method_selected",
          required: true,
          kind: "branch",
          branches: [
            { condition: { field: "method", op: "eq", value: "card" }, next: ["card-flow"] },
            { condition: { field: "method", op: "eq", value: "cash" }, next: ["cash-flow"] },
          ],
        },
        { id: "card-flow", event_key: "card_charged", required: true, kind: "sequence" },
        { id: "cash-flow", event_key: "cash_received", required: true, kind: "sequence" },
      ],
    };
    const g = convertScenarioToPipeGraph(spec);
    expect(g.connections).toHaveLength(2);
    expect(g.connections[0]).toEqual({
      from: "s1",
      to: "card-flow",
      kind: "conditional",
      condition: 'method eq "card"',
    });
    expect(g.connections[1]).toEqual({
      from: "s1",
      to: "cash-flow",
      kind: "conditional",
      condition: 'method eq "cash"',
    });
  });

  it("graphId / version / description 보존", () => {
    const spec: ScenarioSpec = {
      ...base,
      description: "주문 흐름",
      steps: [{ id: "s1", event_key: "order_created", required: true, kind: "sequence" }],
    };
    const g = convertScenarioToPipeGraph(spec);
    expect(g.graphId).toBe("order-flow");
    expect(g.version).toBe("v1");
    expect(g.description).toBe("주문 흐름");
  });
});
