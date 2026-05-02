// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, it, expect } from "vitest";
import {
  extractPipeConcerns, propagatePipeConcerns, analyzePipeImpact, classifyPipeRole,
} from "./pipe-interpret.js";
import type { PipeSpec, PipeGraph, PipeFlow, PipeConnection } from "../types/pipe-spec.js";

import { step } from "./__fixtures__/pipe-fixtures.js";

// ── 헬퍼 ──────────────────────────────────────────────

function makePipe(id: string, overrides?: Partial<PipeSpec>): PipeSpec {
  return {
    pipeId: id,
    version: "1.0.0",
    trigger: { eventKey: `${id}_trigger` },
    flow: step(),
    ...overrides,
  };
}

function conn(from: string, to: string, kind: PipeConnection["kind"] = "next"): PipeConnection {
  return { from, to, kind };
}

function makeGraph(pipes: PipeSpec[], connections: PipeConnection[], entryId?: string): PipeGraph {
  return {
    graphId: "test",
    version: "1.0.0",
    pipes,
    connections,
    entryPipeId: entryId ?? pipes[0]?.pipeId ?? "A",
  };
}

// ── extractPipeConcerns ───────────────────────────────

describe("extractPipeConcerns", () => {
  it("step만 있는 파이프 → 빈 관심사", () => {
    const pipe = makePipe("A");
    expect(extractPipeConcerns(pipe)).toEqual([]);
  });

  it("retry → resilience", () => {
    const pipe = makePipe("A", {
      flow: { kind: "retry", step: step(), maxAttempts: 3 },
    });
    expect(extractPipeConcerns(pipe)).toContain("resilience");
  });

  it("timeout + await → latency", () => {
    const pipe = makePipe("A", {
      flow: {
        kind: "sequence",
        steps: [
          { kind: "timeout", body: step(), duration: 5000 },
          { kind: "await", condition: "ready", then: step() },
        ],
      },
    });
    const concerns = extractPipeConcerns(pipe);
    expect(concerns).toContain("latency");
    expect(concerns.filter(c => c === "latency")).toHaveLength(1); // 중복 없음
  });

  it("parallel → concurrency", () => {
    const pipe = makePipe("A", {
      flow: { kind: "parallel", steps: [step(), step()] },
    });
    expect(extractPipeConcerns(pipe)).toContain("concurrency");
  });

  it("accesses write+read → data-mutation + data-read", () => {
    const pipe = makePipe("A", {
      flow: step("관리", undefined, {
        dataContract: {
          accesses: [
            { schemaId: "orders", columns: ["id"], mode: "write" },
            { schemaId: "users", columns: ["name"], mode: "read" },
          ],
        },
      }),
    });
    const concerns = extractPipeConcerns(pipe);
    expect(concerns).toContain("data-mutation");
    expect(concerns).toContain("data-read");
  });

  it("emit + correlation → async-coupling", () => {
    const pipe = makePipe("A", {
      flow: {
        kind: "sequence",
        steps: [
          { kind: "emit", eventKey: "notify" },
          { kind: "correlation", requestEvent: "req", responseEvent: "res", correlationKey: "id", onMatch: step() },
        ],
      },
    });
    const concerns = extractPipeConcerns(pipe);
    expect(concerns).toContain("async-coupling");
    expect(concerns.filter(c => c === "async-coupling")).toHaveLength(1);
  });

  it("복합 흐름 — 여러 패턴 조합", () => {
    const pipe = makePipe("A", {
      flow: {
        kind: "sequence",
        steps: [
          { kind: "retry", step: step(), maxAttempts: 3 },
          { kind: "parallel", steps: [step(), { kind: "timeout", body: step(), duration: 1000 }] },
          { kind: "tap", observe: step(), step: step() },
        ],
      },
    });
    const concerns = extractPipeConcerns(pipe);
    expect(concerns).toContain("resilience");
    expect(concerns).toContain("concurrency");
    expect(concerns).toContain("latency");
    expect(concerns).toContain("observability");
  });

  it("transition-scope + compensate → resilience", () => {
    const pipe = makePipe("A", {
      flow: {
        kind: "transition-scope",
        transitionId: "transfer.execute",
        body: { kind: "sequence", steps: [step(), step()] },
        events: ["account.debit", "account.credit"],
        compensate: step(),
      },
    });
    expect(extractPipeConcerns(pipe)).toContain("resilience");
  });

  it("transition-scope without compensate → no resilience", () => {
    const pipe = makePipe("A", {
      flow: {
        kind: "transition-scope",
        transitionId: "t1",
        body: step(),
        events: ["e1"],
      },
    });
    expect(extractPipeConcerns(pipe)).not.toContain("resilience");
  });
});

// ── propagatePipeConcerns ─────────────────────────────

describe("propagatePipeConcerns", () => {
  it("next 연결 — resilience 하류 전파", () => {
    const graph = makeGraph(
      [
        makePipe("A", { flow: { kind: "retry", step: step(), maxAttempts: 3 } }),
        makePipe("B"),
      ],
      [conn("A", "B")],
    );
    const map = propagatePipeConcerns(graph);
    const b = map.get("B")!;
    expect(b.inherited.some(i => i.concern === "resilience" && i.from === "A")).toBe(true);
    expect(b.all).toContain("resilience");
  });

  it("conditional 연결 — latency만 전파, resilience 차단", () => {
    const graph = makeGraph(
      [
        makePipe("A", {
          flow: {
            kind: "sequence",
            steps: [
              { kind: "retry", step: step(), maxAttempts: 3 },
              { kind: "timeout", body: step(), duration: 5000 },
            ],
          },
        }),
        makePipe("B"),
      ],
      [{ from: "A", to: "B", kind: "conditional", condition: "type === 'a'" }],
    );
    const map = propagatePipeConcerns(graph);
    const b = map.get("B")!;
    // latency는 conditional에서 전파
    expect(b.inherited.some(i => i.concern === "latency")).toBe(true);
    // resilience는 conditional에서 전파 안 됨
    expect(b.inherited.some(i => i.concern === "resilience")).toBe(false);
  });

  it("event 연결 — async-coupling 전파", () => {
    const graph = makeGraph(
      [
        makePipe("A", { flow: { kind: "emit", eventKey: "notify" } }),
        makePipe("B"),
      ],
      [{ from: "A", to: "B", kind: "event" }],
    );
    const map = propagatePipeConcerns(graph);
    expect(map.get("B")!.inherited.some(i => i.concern === "async-coupling")).toBe(true);
  });

  it("compensate — 양방향 전파", () => {
    const graph = makeGraph(
      [
        makePipe("A", {
          flow: step("저장", undefined, {
            dataContract: {
              accesses: [{ schemaId: "orders", columns: ["status"], mode: "write" }],
            },
          }),
        }),
        makePipe("B"),
      ],
      [{ from: "A", to: "B", kind: "compensate" }],
    );
    const map = propagatePipeConcerns(graph);
    // B가 A의 data-mutation을 상속 (downstream)
    expect(map.get("B")!.inherited.some(i => i.concern === "data-mutation")).toBe(true);
    // A도 B에서 올 수 있음 (upstream) — B는 직접 관심사 없으므로 상속 없음
  });

  it("feedback — upstream latency 전파", () => {
    const graph = makeGraph(
      [
        makePipe("A"),
        makePipe("B", { flow: { kind: "timeout", body: step(), duration: 3000 } }),
      ],
      [conn("A", "B"), { from: "B", to: "A", kind: "feedback" }],
    );
    const map = propagatePipeConcerns(graph);
    // B의 latency가 feedback을 통해 A로 전파 (upstream)
    expect(map.get("A")!.inherited.some(i => i.concern === "latency" && i.from === "B")).toBe(true);
  });

  it("전이적 전파 축소 — next→conditional 체인에서 resilience 차단", () => {
    // A(retry) --next--> B --conditional--> C
    // next: [resilience, latency, data-mutation]
    // conditional: [latency]
    // → C에는 resilience 도달 불가 (교집합이 비어서)
    const graph = makeGraph(
      [
        makePipe("A", { flow: { kind: "retry", step: step(), maxAttempts: 3 } }),
        makePipe("B"),
        makePipe("C"),
      ],
      [
        conn("A", "B"),
        { from: "B", to: "C", kind: "conditional", condition: "x" },
      ],
    );
    const map = propagatePipeConcerns(graph);
    // B는 next를 통해 resilience 상속
    expect(map.get("B")!.inherited.some(i => i.concern === "resilience")).toBe(true);
    // C는 conditional을 통해서는 resilience 전파 불가
    expect(map.get("C")!.inherited.some(i => i.concern === "resilience")).toBe(false);
  });
});

// ── analyzePipeImpact ─────────────────────────────────

describe("analyzePipeImpact", () => {
  it("체인 downstream 전파", () => {
    const graph = makeGraph(
      [makePipe("A"), makePipe("B"), makePipe("C")],
      [conn("A", "B"), conn("B", "C")],
    );
    const result = analyzePipeImpact(graph, "A");
    expect(result.blastRadius).toBe(2);
    expect(result.impacted.map(i => i.pipeId).toSorted()).toEqual(["B", "C"]);
    expect(result.impacted.find(i => i.pipeId === "B")!.depth).toBe(1);
    expect(result.impacted.find(i => i.pipeId === "C")!.depth).toBe(2);
  });

  it("compensate 양방향 영향", () => {
    const graph = makeGraph(
      [makePipe("A"), makePipe("B"), makePipe("C")],
      [
        { from: "A", to: "B", kind: "compensate" },
        conn("B", "C"),
      ],
    );
    // C에서 변경 → B (downstream from C? 아니, C→B 연결 없음)
    // B에서 변경 → A (compensate upstream) + C (downstream)
    const result = analyzePipeImpact(graph, "B");
    expect(result.impacted.some(i => i.pipeId === "A" && i.direction === "upstream")).toBe(true);
    expect(result.impacted.some(i => i.pipeId === "C" && i.direction === "downstream")).toBe(true);
  });

  it("byConcern 집계", () => {
    const graph = makeGraph(
      [
        makePipe("A", { flow: { kind: "retry", step: step(), maxAttempts: 3 } }),
        makePipe("B", { flow: { kind: "timeout", body: step(), duration: 1000 } }),
        makePipe("C"),
      ],
      [conn("A", "B"), conn("B", "C")],
    );
    const result = analyzePipeImpact(graph, "A");
    // B: resilience(direct) + latency(direct), C: latency(inherited from B)
    expect(result.byConcern.resilience).toBeGreaterThanOrEqual(1);
    expect(result.byConcern.latency).toBeGreaterThanOrEqual(1);
  });

  it("미등록 pipeId → 빈 결과", () => {
    const graph = makeGraph([makePipe("A")], []);
    const result = analyzePipeImpact(graph, "nonexistent");
    expect(result.blastRadius).toBe(0);
    expect(result.impacted).toHaveLength(0);
  });
});

// ── classifyPipeRole ──────────────────────────────────

describe("classifyPipeRole", () => {
  it("produces 있음 → transformer", () => {
    const pipe = makePipe("A", { produces: ["done"] });
    expect(classifyPipeRole(pipe)).toBe("transformer");
  });

  it("emit만 있고 produces 없음 → producer", () => {
    const pipe = makePipe("A", {
      flow: { kind: "emit", eventKey: "notify" },
    });
    expect(classifyPipeRole(pipe)).toBe("producer");
  });

  it("tap 흐름 + produces 없음 → observer", () => {
    const pipe = makePipe("A", {
      flow: { kind: "tap", observe: step(), step: step() },
    });
    expect(classifyPipeRole(pipe)).toBe("observer");
  });

  it("branch 흐름 + data access 없음 → router", () => {
    const pipe = makePipe("A", {
      flow: { kind: "branch", condition: "type", paths: [step(), step()] },
    });
    expect(classifyPipeRole(pipe)).toBe("router");
  });

  it("명시 ports는 flow.kind fallback보다 우선한다", () => {
    const tapTransformer = makePipe("A", {
      flow: { kind: "tap", observe: step(), step: step() },
      ports: [
        { portId: "request", direction: "in" },
        { portId: "result", direction: "out" },
      ],
    });
    const branchConsumer = makePipe("B", {
      flow: { kind: "branch", condition: "type", paths: [step(), step()] },
      ports: [{ portId: "request", direction: "in" }],
    });

    expect(classifyPipeRole(tapTransformer)).toBe("transformer");
    expect(classifyPipeRole(branchConsumer)).toBe("consumer");
  });
});

// ── 불변량 ────────────────────────────────────────────

describe("불변량", () => {
  it("순환 그래프 — BFS 무한루프 없음", () => {
    const graph = makeGraph(
      [
        makePipe("A", { flow: { kind: "retry", step: step(), maxAttempts: 2 } }),
        makePipe("B", { flow: { kind: "timeout", body: step(), duration: 1000 } }),
        makePipe("C"),
      ],
      [conn("A", "B"), conn("B", "C"), { from: "C", to: "A", kind: "feedback" }],
    );
    // 무한루프 없이 완료되어야 함
    const map = propagatePipeConcerns(graph);
    expect(map.size).toBe(3);

    const impact = analyzePipeImpact(graph, "A");
    expect(impact.blastRadius).toBeLessThanOrEqual(3);
  });

  it("단일 파이프 그래프 — 전파 없음", () => {
    const graph = makeGraph([makePipe("A", {
      flow: { kind: "retry", step: step(), maxAttempts: 3 },
    })], []);
    const map = propagatePipeConcerns(graph);
    const a = map.get("A")!;
    expect(a.direct).toContain("resilience");
    expect(a.inherited).toHaveLength(0);
  });
});
