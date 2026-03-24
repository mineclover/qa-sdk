import { describe, expect, it } from "vitest";
import { GraphRegistry } from "./graph-registry.js";
import { attachFlowSchemaEdges, deriveFlowSchemaEdges } from "./flow-schema-relations.js";
import type { AxisNode, DomainNode, FlowSchemaNode, PrefixNode } from "./dkg.types.js";
import { traceNode } from "./skills/trace.js";
import { DEMO_CATALOG } from "demo-snapshot";

function makeFlowSchema(id: string, name: string): FlowSchemaNode {
  return {
    kind: "flow-schema",
    id,
    name,
    version: "v1",
    gates: [],
    totalPaths: 1,
    coreGateIds: [],
  };
}

describe("flow-schema-relations", () => {
  it("기존 DKG 엣지 타입만으로 FlowSchema 관계를 표현한다", () => {
    const edges = deriveFlowSchemaEdges({
      flowSchemaId: "coordinate-design",
      axisIds: ["decision_phase", "decision_phase"],
      observedPrefixIds: ["decision_event", "model_apply"],
      domainId: "decision-domain",
      subFlowIds: ["office-hours", "office-hours", "coordinate-design"],
    });

    expect(edges).toEqual([
      { type: "composes", from: "coordinate-design", to: "decision_phase" },
      { type: "observes", from: "coordinate-design", to: "decision_event" },
      { type: "observes", from: "coordinate-design", to: "model_apply" },
      { type: "contains", from: "coordinate-design", to: "decision-domain" },
      { type: "references", from: "coordinate-design", to: "office-hours" },
    ]);
  });

  it("GraphRegistry에 FlowSchema 관계 엣지를 연결한다", () => {
    const graph = new GraphRegistry();

    const domain: DomainNode = {
      kind: "domain",
      id: "decision-domain",
      name: "의사결정",
      prefixes: ["decision_event", "model_apply"],
      sharedAxes: ["decision_phase"],
      boundary: { exports: ["decision_event"], internal: ["model_apply"] },
    };
    const axis: AxisNode = {
      kind: "axis",
      id: "decision_phase",
      name: "결정 단계",
      currentVersions: ["v1"],
    };
    const decisionEvent: PrefixNode = {
      kind: "prefix",
      id: "decision_event",
      name: "분기 선택 이벤트",
      dimLabels: ["flowType", "phase"],
      category: "observation",
    };
    const modelApply: PrefixNode = {
      kind: "prefix",
      id: "model_apply",
      name: "인지 모델 적용",
      dimLabels: ["model", "magnitude"],
      category: "observation",
    };
    const mainFlow = makeFlowSchema("coordinate-design", "좌표 설계");
    const subFlow = makeFlowSchema("office-hours", "오피스 아워");

    for (const node of [domain, axis, decisionEvent, modelApply, mainFlow, subFlow]) {
      graph.addNode(node);
    }

    attachFlowSchemaEdges(graph, {
      flowSchemaId: mainFlow.id,
      axisIds: [axis.id],
      observedPrefixIds: [decisionEvent.id, modelApply.id],
      domainId: domain.id,
      subFlowIds: [subFlow.id],
    });

    expect(graph.neighbors(mainFlow.id, "composes")).toEqual([axis.id]);
    expect(graph.neighbors(mainFlow.id, "observes")).toEqual([decisionEvent.id, modelApply.id]);
    expect(graph.neighbors(mainFlow.id, "contains")).toEqual([domain.id]);
    expect(graph.neighbors(mainFlow.id, "references")).toEqual([subFlow.id]);
  });

  it("traceNode가 flow-schema의 domain 소속을 contains 정방향에서도 읽는다", () => {
    const graph = new GraphRegistry();

    const domain: DomainNode = {
      kind: "domain",
      id: "decision-domain",
      name: "의사결정",
      prefixes: ["decision_event"],
      sharedAxes: ["decision_phase"],
      boundary: { exports: ["decision_event"], internal: [] },
    };
    const flow = makeFlowSchema("coordinate-design", "좌표 설계");

    graph.addNode(domain);
    graph.addNode(flow);
    attachFlowSchemaEdges(graph, {
      flowSchemaId: flow.id,
      domainId: domain.id,
    });

    const traced = traceNode(graph, DEMO_CATALOG, flow.id);

    expect(traced?.membership).toEqual([
      { id: domain.id, kind: domain.kind, name: domain.name },
    ]);
  });
});
