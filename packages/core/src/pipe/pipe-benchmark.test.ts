/**
 * 시뮬레이션 커버리지 + 직렬화 + 성능 벤치마크
 */
import { describe, it, expect } from "vitest";
import { simulate } from "./pipe-simulate.js";
import { PipeRunner, ExecutorRegistry, PipeContext } from "./pipe-runtime.js";
import { serializePipeGraph, deserializePipeGraph } from "./pipe-serialize.js";
import { countPipePaths, countGraphPaths } from "./pipe-path.js";
import { analyzePipeComplexity } from "./pipe-analyze.js";
import type { PipeSpec, PipeGraph, PipeFlow } from "../types/pipe-spec.js";

import { step } from "./__fixtures__/pipe-fixtures.js";

function makePipe(id: string, trigger: string, flow: PipeFlow, produces?: string[]): PipeSpec {
  return { pipeId: id, version: "v1", trigger: { eventKey: trigger }, flow, produces };
}

// ── 커버리지 확인 ────────────────────────────────────

describe("시뮬레이션 커버리지", () => {
  const allFlowKinds = [
    "step", "sequence", "branch", "optional",
    "parallel", "race", "await",
    "retry", "fallback",
    "loop", "compensate", "emit",
    "finally", "timeout", "feedback",
    "map", "reduce", "buffer", "filter",
    "circuit-breaker", "throttle", "debounce",
    "split", "enrich", "tap",
    "resequence", "window",
    "dedup", "correlation",
  ];

  it("Phase 2 simulate() — 29종 PipeFlow 전부 시뮬레이션 가능", () => {
    for (const kind of allFlowKinds) {
      let flow: PipeFlow;
      switch (kind) {
        case "step": flow = step("소비"); break;
        case "sequence": flow = { kind: "sequence", steps: [step("소비"), step("생산")] }; break;
        case "branch": flow = { kind: "branch", condition: "x", paths: [step("소비"), step("생산")] }; break;
        case "optional": flow = { kind: "optional", step: step("소비") }; break;
        case "parallel": flow = { kind: "parallel", steps: [step("소비"), step("생산")] }; break;
        case "race": flow = { kind: "race", steps: [step("소비"), step("생산")] }; break;
        case "await": flow = { kind: "await", condition: "ready", then: step("소비") }; break;
        case "retry": flow = { kind: "retry", maxAttempts: 3, step: step("관리") }; break;
        case "fallback": flow = { kind: "fallback", try: step("관리"), catch: step("관리") }; break;
        case "loop": flow = { kind: "loop", body: step("관리"), until: "done" }; break;
        case "compensate": flow = { kind: "compensate", forward: step("생산"), compensate: step("관리") }; break;
        case "transition-scope": flow = { kind: "transition-scope", transitionId: "t1", body: step("생산"), events: ["e1"] }; break;
        case "emit": flow = { kind: "emit", eventKey: "notify" }; break;
        case "finally": flow = { kind: "finally", body: step("생산"), cleanup: step("저장") }; break;
        case "timeout": flow = { kind: "timeout", body: step("관리"), duration: 1000 }; break;
        case "feedback": flow = { kind: "feedback", body: step("관리"), feedbackEvent: "fb", until: "done" }; break;
        case "map": flow = { kind: "map", itemFlow: step("생산"), collection: "items" }; break;
        case "reduce": flow = { kind: "reduce", step: step("관리"), initial: "0", accumulator: "sum" }; break;
        case "buffer": flow = { kind: "buffer", body: step("저장"), count: 10 }; break;
        case "filter": flow = { kind: "filter", condition: "x > 0", step: step("생산") }; break;
        case "circuit-breaker": flow = { kind: "circuit-breaker", step: step("관리"), failureThreshold: 5, cooldown: 3000 }; break;
        case "throttle": flow = { kind: "throttle", step: step("소비"), rate: 10, interval: 1000 }; break;
        case "debounce": flow = { kind: "debounce", step: step("소비"), wait: 100 }; break;
        case "split": flow = { kind: "split", splitBy: "items", itemFlow: step("생산") }; break;
        case "enrich": flow = { kind: "enrich", source: "svc", mergeField: "data", step: step("생산") }; break;
        case "tap": flow = { kind: "tap", observe: step("관리"), step: step("생산") }; break;
        case "resequence": flow = { kind: "resequence", orderBy: "seq", windowSize: 10, step: step("소비") }; break;
        case "window": flow = { kind: "window", type: "tumbling", size: 1000, body: step("관리") }; break;
        case "dedup": flow = { kind: "dedup", keyField: "id", step: step("생산") }; break;
        case "correlation": flow = { kind: "correlation", requestEvent: "req", responseEvent: "res", correlationKey: "id", onMatch: step("생산") }; break;
        default: flow = step("소비");
      }

      const r = simulate({
        graph: { graphId: "g", version: "v1", pipes: [makePipe("p", "start", flow)], connections: [], entryPipeId: "p" },
        initialEvent: { eventKey: "start" },
      });
      expect(r.status).toBe("complete");
    }
  });

  it("Phase 3 PipeRunner — 기본 흐름 실행 가능", async () => {
    const executors = new ExecutorRegistry();
    for (const f of ["소비", "관리", "생산", "저장"]) {
      executors.register({ facet: f, execute: async () => ({ status: "ok" as const, output: `${f}_done` }) });
    }
    const runner = new PipeRunner(executors);

    const graph: PipeGraph = {
      graphId: "g", version: "v1",
      pipes: [makePipe("p", "start", {
        kind: "sequence", steps: [step("소비"), step("관리"), step("생산"), step("저장")],
      })],
      connections: [], entryPipeId: "p",
    };

    const r = await runner.run(graph, { eventKey: "start" });
    expect(r.status).toBe("complete");
    expect(r.steps.filter(s => s.kind === "step")).toHaveLength(4);
  });
});

// ── 직렬화 ───────────────────────────────────────────

describe("직렬화 성능 + 정확성", () => {
  function buildLargeGraph(pipeCount: number): PipeGraph {
    const pipes: PipeSpec[] = [];
    const connections: PipeGraph["connections"] = [];

    for (let i = 0; i < pipeCount; i++) {
      pipes.push(makePipe(`p${i}`, `e${i}`, {
        kind: "sequence",
        steps: [
          step("소비", `read_${i}`),
          { kind: "branch", condition: "type", paths: [step("생산"), step("저장")] },
          step("저장", `save_${i}`),
        ],
      }, i < pipeCount - 1 ? [`e${i + 1}`] : undefined));
    }

    for (let i = 0; i < pipeCount - 1; i++) {
      connections.push({ from: `p${i}`, to: `p${i + 1}`, kind: "next" });
    }

    return { graphId: "large", version: "v1", pipes, connections, entryPipeId: "p0" };
  }

  it("직렬화 라운드트립 — 10 파이프 그래프", () => {
    const graph = buildLargeGraph(10);
    const json = serializePipeGraph(graph);
    const restored = deserializePipeGraph(json);

    expect(restored.graphId).toBe("large");
    expect(restored.pipes).toHaveLength(10);
    expect(restored.connections).toHaveLength(9);
  });

  it("직렬화 라운드트립 — 100 파이프 그래프", () => {
    const graph = buildLargeGraph(100);
    const json = serializePipeGraph(graph);
    const restored = deserializePipeGraph(json);

    expect(restored.pipes).toHaveLength(100);
    expect(restored.connections).toHaveLength(99);
  });

  it("직렬화 크기 측정", () => {
    const small = buildLargeGraph(5);
    const medium = buildLargeGraph(50);
    const large = buildLargeGraph(100);

    const smallJson = serializePipeGraph(small);
    const mediumJson = serializePipeGraph(medium);
    const largeJson = serializePipeGraph(large);

    // 크기 비례 확인 (선형적이어야)
    expect(mediumJson.length).toBeGreaterThan(smallJson.length * 5);
    expect(largeJson.length).toBeGreaterThan(mediumJson.length);

    // 참고 출력
    console.log(`직렬화 크기: 5파이프=${(smallJson.length / 1024).toFixed(1)}KB, 50파이프=${(mediumJson.length / 1024).toFixed(1)}KB, 100파이프=${(largeJson.length / 1024).toFixed(1)}KB`);
  });
});

// ── 성능 벤치마크 ────────────────────────────────────

describe("성능 벤치마크", () => {
  function buildComplexGraph(): PipeGraph {
    return {
      graphId: "complex", version: "v1",
      pipes: [
        makePipe("order", "start", {
          kind: "sequence",
          steps: [
            step("소비"),
            { kind: "branch", condition: "type", paths: [
              { kind: "sequence", steps: [step("관리"), step("생산")] },
              step("생산"),
            ]},
            step("저장"),
          ],
        }, ["order_done"]),
        makePipe("payment", "order_done", {
          kind: "finally",
          body: { kind: "retry", maxAttempts: 3, step: { kind: "fallback", try: step("관리"), catch: step("관리") } },
          cleanup: step("저장"),
        }, ["pay_done"]),
        makePipe("notify", "pay_done", {
          kind: "tap", observe: step("관리"), step: { kind: "emit", eventKey: "notified" },
        }),
      ],
      connections: [],
      entryPipeId: "order",
    };
  }

  it("countPipePaths — 1000회 실행 < 50ms", () => {
    const graph = buildComplexGraph();
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      for (const pipe of graph.pipes) countPipePaths(pipe.flow);
    }
    const elapsed = Date.now() - start;
    console.log(`countPipePaths 1000회: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(50);
  });

  it("countGraphPaths — 1000회 실행 < 100ms", () => {
    const graph = buildComplexGraph();
    const start = Date.now();
    for (let i = 0; i < 1000; i++) countGraphPaths(graph);
    const elapsed = Date.now() - start;
    console.log(`countGraphPaths 1000회: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(100);
  });

  it("simulate() — 1000회 실행 < 200ms", () => {
    const graph = buildComplexGraph();
    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      simulate({ graph, initialEvent: { eventKey: "start" } });
    }
    const elapsed = Date.now() - start;
    console.log(`simulate() 1000회: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(200);
  });

  it("analyzePipeComplexity — 1000회 실행 < 200ms", () => {
    const graph = buildComplexGraph();
    const start = Date.now();
    for (let i = 0; i < 1000; i++) analyzePipeComplexity(graph);
    const elapsed = Date.now() - start;
    console.log(`analyzePipeComplexity 1000회: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(200);
  });

  it("serialize + deserialize 라운드트립 — 100회 < 100ms", () => {
    const graph = buildComplexGraph();
    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      const json = serializePipeGraph(graph);
      deserializePipeGraph(json);
    }
    const elapsed = Date.now() - start;
    console.log(`직렬화 라운드트립 100회: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(100);
  });

  it("PipeRunner.run() — 100회 실행 < 500ms", async () => {
    const executors = new ExecutorRegistry();
    for (const f of ["소비", "관리", "생산", "저장"]) {
      executors.register({ facet: f, execute: async () => ({ status: "ok" as const, output: "done" }) });
    }
    const runner = new PipeRunner(executors);
    const graph = buildComplexGraph();

    const start = Date.now();
    for (let i = 0; i < 100; i++) {
      await runner.run(graph, { eventKey: "start" });
    }
    const elapsed = Date.now() - start;
    console.log(`PipeRunner.run() 100회: ${elapsed}ms`);
    expect(elapsed).toBeLessThan(500);
  });
});
