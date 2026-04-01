import { describe, it, expect } from "vitest";
import { generateAsyncApi, asyncApiToYaml, asyncApiToJson } from "./asyncapi-gen.js";
import type { PipeGraph, PipeFlow } from "./types/pipe-spec.js";
import type { PipeSpec } from "./types/pipe-spec.js";

import { step } from "./__fixtures__/pipe-fixtures.js";

function makePipe(id: string, trigger: string, flow: PipeFlow, produces?: string[]): PipeSpec {
  return { pipeId: id, version: "v1", trigger: { eventKey: trigger }, flow, produces };
}

describe("generateAsyncApi", () => {
  it("PipeGraph → AsyncAPI 스펙 생성", () => {
    const graph: PipeGraph = {
      graphId: "order-system", version: "v1",
      pipes: [
        makePipe("order", "order_submitted", step("소비"), ["order_confirmed"]),
        makePipe("payment", "order_confirmed", step("관리"), ["payment_done"]),
        makePipe("notify", "payment_done", step("생산")),
      ],
      connections: [],
      entryPipeId: "order",
    };

    const spec = generateAsyncApi(graph, { source: "//order-service" }, {
      title: "Order Service Events",
      version: "v1",
    });

    expect(spec.asyncapi).toBe("3.0.0");
    expect(spec.info.title).toBe("Order Service Events");

    // 채널: 트리거 + produces
    expect(Object.keys(spec.channels)).toContain("order_submitted");
    expect(Object.keys(spec.channels)).toContain("order_confirmed");
    expect(Object.keys(spec.channels)).toContain("payment_done");

    // 오퍼레이션: receive + send
    expect(Object.keys(spec.operations)).toContain("receive_order");
    expect(Object.keys(spec.operations)).toContain("send_order_order_confirmed");
    expect(spec.operations["receive_order"].action).toBe("receive");
    expect(spec.operations["send_order_order_confirmed"].action).toBe("send");
  });

  it("서버 정보 포함", () => {
    const graph: PipeGraph = {
      graphId: "g", version: "v1",
      pipes: [makePipe("p", "e", step("소비"))],
      connections: [], entryPipeId: "p",
    };

    const spec = generateAsyncApi(graph, { source: "//svc" }, {
      title: "Test",
      version: "v1",
      servers: { production: { url: "broker.example.com", protocol: "kafka" } },
    });

    expect(spec.servers?.production.host).toBe("broker.example.com");
    expect(spec.servers?.production.protocol).toBe("kafka");
  });
});

describe("asyncApiToYaml", () => {
  it("YAML 문자열 생성", () => {
    const graph: PipeGraph = {
      graphId: "g", version: "v1",
      pipes: [
        makePipe("order", "order_submitted", step("소비"), ["confirmed"]),
      ],
      connections: [], entryPipeId: "order",
    };

    const spec = generateAsyncApi(graph, { source: "//svc" }, { title: "Test API", version: "v2" });
    const yaml = asyncApiToYaml(spec);

    expect(yaml).toContain("asyncapi: '3.0.0'");
    expect(yaml).toContain("title: Test API");
    expect(yaml).toContain("version: 'v2'");
    expect(yaml).toContain("order_submitted:");
    expect(yaml).toContain("action: receive");
    expect(yaml).toContain("action: send");
  });
});

describe("asyncApiToJson", () => {
  it("JSON 문자열 생성", () => {
    const graph: PipeGraph = {
      graphId: "g", version: "v1",
      pipes: [makePipe("p", "e", step("소비"))],
      connections: [], entryPipeId: "p",
    };

    const spec = generateAsyncApi(graph, { source: "//svc" }, { title: "Test", version: "v1" });
    const json = asyncApiToJson(spec);
    const parsed = JSON.parse(json);

    expect(parsed.asyncapi).toBe("3.0.0");
    expect(parsed.info.title).toBe("Test");
  });
});
