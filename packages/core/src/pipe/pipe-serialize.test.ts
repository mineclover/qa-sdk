import { describe, it, expect } from "vitest";
import { serializePipeSpec, deserializePipeSpec, serializePipeGraph, deserializePipeGraph } from "./pipe-serialize.js";
import { step, simplePipe, simpleGraph } from "./__fixtures__/pipe-fixtures.js";
import type { PipeGraph } from "../types/pipe-spec.js";

describe("직렬화", () => {
  it("PipeSpec 라운드트립", () => {
    const json = serializePipeSpec(simplePipe);
    const restored = deserializePipeSpec(json);
    expect(restored.pipeId).toBe("p1");
    expect(restored.flow.kind).toBe("step");
  });

  it("PipeSpec ports 라운드트립", () => {
    const json = serializePipeSpec({
      ...simplePipe,
      ports: [
        { portId: "order", direction: "in", facetType: "order.created", label: "주문 입력", required: true },
        { portId: "result", direction: "out", facetType: "order.validated", label: "검증 결과" },
      ],
    });
    const restored = deserializePipeSpec(json);
    expect(restored.ports).toEqual([
      { portId: "order", direction: "in", facetType: "order.created", label: "주문 입력", required: true },
      { portId: "result", direction: "out", facetType: "order.validated", label: "검증 결과" },
    ]);
  });

  it("PipeGraph 라운드트립", () => {
    const json = serializePipeGraph(simpleGraph);
    const restored = deserializePipeGraph(json);
    expect(restored.graphId).toBe("g1");
    expect(restored.pipes).toHaveLength(2);
    expect(restored.connections).toHaveLength(1);
  });

  it("PipeGraph PortRef 라운드트립 + string 연결 하위 호환", () => {
    const graph: PipeGraph = {
      graphId: "g-portref",
      version: "v1",
      pipes: [
        {
          ...simplePipe,
          pipeId: "source",
          trigger: { eventKey: "source.started" },
          ports: [{ portId: "payment_result", direction: "out", facetType: "payment.result" }],
        },
        {
          ...simplePipe,
          pipeId: "target",
          trigger: { eventKey: "target.started" },
          ports: [{ portId: "payment_input", direction: "in", facetType: "payment.result" }],
        },
      ],
      connections: [
        { from: "source", to: "target", kind: "next" },
        {
          from: { pipeId: "source", portId: "payment_result" },
          to: { pipeId: "target", portId: "payment_input" },
          kind: "event",
          facetType: "payment.result",
        },
      ],
      entryPipeId: "source",
    };

    const json = serializePipeGraph(graph);
    const restored = deserializePipeGraph(json);

    expect(restored.connections[0].from).toBe("source");
    expect(restored.connections[0].to).toBe("target");
    expect(restored.connections[1]).toEqual({
      from: { pipeId: "source", portId: "payment_result" },
      to: { pipeId: "target", portId: "payment_input" },
      kind: "event",
      facetType: "payment.result",
    });
  });

  it("무효 PipeSpec 역직렬화 시 에러", () => {
    const badJson = JSON.stringify({ pipeId: "bad", flow: { kind: "retry", step: step(), maxAttempts: 0 }, trigger: { eventKey: "e" } });
    expect(() => deserializePipeSpec(badJson)).toThrow("검증 실패");
  });

  it("중복 ports가 있는 PipeSpec 역직렬화 시 에러", () => {
    const badJson = JSON.stringify({
      ...simplePipe,
      ports: [
        { portId: "order", direction: "in", facetType: "order.created" },
        { portId: "order", direction: "in", facetType: "order.updated" },
      ],
    });
    expect(() => deserializePipeSpec(badJson)).toThrow("중복 portId");
  });

  it("무효 PipeGraph 역직렬화 시 에러", () => {
    const badJson = JSON.stringify({ graphId: "g", version: "v1", pipes: [], connections: [], entryPipeId: "missing" });
    expect(() => deserializePipeGraph(badJson)).toThrow("검증 실패");
  });

  it("존재하지 않는 PortRef가 있는 PipeGraph 역직렬화 시 에러", () => {
    const badJson = JSON.stringify({
      graphId: "g-port-invalid",
      version: "v1",
      pipes: [
        {
          ...simplePipe,
          pipeId: "source",
          trigger: { eventKey: "source.started" },
          ports: [{ portId: "payment_result", direction: "out", facetType: "payment.result" }],
        },
        {
          ...simplePipe,
          pipeId: "target",
          trigger: { eventKey: "target.started" },
          ports: [{ portId: "payment_input", direction: "in", facetType: "payment.result" }],
        },
      ],
      connections: [{
        from: { pipeId: "source", portId: "missing" },
        to: { pipeId: "target", portId: "payment_input" },
        kind: "event",
      }],
      entryPipeId: "source",
    });

    expect(() => deserializePipeGraph(badJson)).toThrow("portId \"missing\"");
  });
});
