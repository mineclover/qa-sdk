/**
 * 시뮬레이션 고급 시나리오 — 29종 PipeFlow + 8종 ConnectionKind 커버리지
 */
import { describe, it, expect } from "vitest";
import { simulate } from "./pipe-simulate.js";
import type { PipeSpec, PipeGraph, PipeFlow } from "./types/pipe-spec.js";

import { step } from "./__fixtures__/pipe-fixtures.js";

function makeGraph(pipes: PipeSpec[], connections: PipeGraph["connections"] = []): PipeGraph {
  return {
    graphId: "test", version: "v1",
    pipes,
    connections,
    entryPipeId: pipes[0].pipeId,
  };
}

function makePipe(id: string, trigger: string, flow: PipeFlow, produces?: string[]): PipeSpec {
  return { pipeId: id, version: "v1", trigger: { eventKey: trigger }, flow, produces };
}

describe("PipeFlow 시뮬레이션 — 29종 커버리지", () => {
  // ── 기본 ────────────────────────────────────────────

  it("step — 패싯 실행", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", step("소비", "consumed"))]),
      initialEvent: { eventKey: "start" },
    });
    expect(r.facetTrace).toEqual(["소비"]);
    expect(r.steps[0].eventKey).toBe("consumed");
  });

  it("sequence — 순차 실행 순서 보장", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "sequence",
        steps: [step("소비"), step("관리"), step("생산"), step("저장")],
      })]),
      initialEvent: { eventKey: "start" },
    });
    expect(r.facetTrace).toEqual(["소비", "관리", "생산", "저장"]);
  });

  // ── 분기 ────────────────────────────────────────────

  it("branch — branchResolver로 경로 제어", () => {
    const flow: PipeFlow = {
      kind: "branch", condition: "type",
      paths: [step("생산"), step("저장"), step("관리")],
    };
    // 세 번째 경로
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", flow)]),
      initialEvent: { eventKey: "start" },
      branchResolver: () => 2,
    });
    expect(r.facetTrace).toEqual(["관리"]);
  });

  it("optional — filterResolver로 통과/스킵", () => {
    const flow: PipeFlow = { kind: "optional", step: step("생산") };

    const pass = simulate({
      graph: makeGraph([makePipe("p", "start", flow)]),
      initialEvent: { eventKey: "start" },
      filterResolver: () => true,
    });
    expect(pass.facetTrace).toEqual(["생산"]);

    const skip = simulate({
      graph: makeGraph([makePipe("p", "start", flow)]),
      initialEvent: { eventKey: "start" },
      filterResolver: () => false,
    });
    expect(skip.facetTrace).toEqual([]);
    expect(skip.steps[0].status).toBe("skipped");
  });

  // ── 동시성 ──────────────────────────────────────────

  it("parallel — 모든 step 실행", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "parallel",
        steps: [step("소비"), step("관리"), step("저장")],
      })]),
      initialEvent: { eventKey: "start" },
    });
    expect(r.facetTrace).toContain("소비");
    expect(r.facetTrace).toContain("관리");
    expect(r.facetTrace).toContain("저장");
  });

  it("race — raceResolver로 승자 선택", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "race",
        steps: [step("소비"), step("생산"), step("저장")],
      })]),
      initialEvent: { eventKey: "start" },
      raceResolver: () => 1,
    });
    expect(r.facetTrace).toEqual(["생산"]);
  });

  it("await — then 실행 + 시간 경과", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "await", condition: "ready", timeout: 5000,
        then: step("생산"),
      })]),
      initialEvent: { eventKey: "start", timestamp: 0 },
    });
    expect(r.facetTrace).toEqual(["생산"]);
    expect(r.totalTime).toBeGreaterThanOrEqual(5000);
  });

  // ── 내결함 ──────────────────────────────────────────

  it("retry — 재시도 step 실행", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "retry", maxAttempts: 3, backoff: 100,
        step: step("관리"),
      })]),
      initialEvent: { eventKey: "start" },
    });
    expect(r.facetTrace).toContain("관리");
  });

  it("fallback — failureResolver=true → try 경로", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "fallback",
        try: step("관리", "primary"),
        catch: step("관리", "backup"),
      })]),
      initialEvent: { eventKey: "start" },
      failureResolver: () => true,
    });
    expect(r.steps.find(s => s.eventKey === "primary")).toBeDefined();
    expect(r.steps.find(s => s.eventKey === "backup")).toBeUndefined();
  });

  it("fallback — failureResolver=false → catch 경로", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "fallback",
        try: step("관리", "primary"),
        catch: step("관리", "backup"),
      })]),
      initialEvent: { eventKey: "start" },
      failureResolver: () => false,
    });
    expect(r.steps.find(s => s.eventKey === "backup")).toBeDefined();
    expect(r.steps.find(s => s.eventKey === "primary")).toBeUndefined();
  });

  // ── 반복/트랜잭션/비동기 ─────────────────────────────

  it("loop — body 1회 실행", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "loop", body: step("관리"), until: "done",
      })]),
      initialEvent: { eventKey: "start" },
    });
    expect(r.facetTrace).toContain("관리");
  });

  it("compensate — forward 실행", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "compensate",
        forward: step("생산", "create"),
        compensate: step("관리", "undo"),
      })]),
      initialEvent: { eventKey: "start" },
    });
    expect(r.steps.find(s => s.eventKey === "create")).toBeDefined();
  });

  it("emit — 이벤트 생산", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "emit", eventKey: "notification",
      })]),
      initialEvent: { eventKey: "start" },
    });
    expect(r.producedEvents.map(e => e.eventKey)).toContain("notification");
  });

  // ── 정리/시간/제어 ──────────────────────────────────

  it("finally — body + cleanup 모두 실행", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "finally",
        body: step("생산"),
        cleanup: step("저장"),
      })]),
      initialEvent: { eventKey: "start" },
    });
    expect(r.facetTrace).toEqual(["생산", "저장"]);
  });

  it("timeout — body 실행 + 시간 기록", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "timeout", body: step("관리"), duration: 3000,
      })]),
      initialEvent: { eventKey: "start" },
    });
    expect(r.facetTrace).toContain("관리");
  });

  it("feedback — body 실행", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "feedback",
        body: step("관리"),
        feedbackEvent: "sensor",
        until: "converge",
      })]),
      initialEvent: { eventKey: "start" },
    });
    expect(r.facetTrace).toContain("관리");
  });

  // ── 배치 ────────────────────────────────────────────

  it("map — itemFlow 실행", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "map", itemFlow: step("생산"), collection: "items",
      })]),
      initialEvent: { eventKey: "start" },
    });
    expect(r.facetTrace).toContain("생산");
  });

  it("reduce — step 실행", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "reduce", step: step("관리"), initial: "0", accumulator: "sum",
      })]),
      initialEvent: { eventKey: "start" },
    });
    expect(r.facetTrace).toContain("관리");
  });

  it("buffer — duration 경과 + body 실행", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "buffer", body: step("저장"), count: 10, duration: 2000,
      })]),
      initialEvent: { eventKey: "start", timestamp: 0 },
    });
    expect(r.facetTrace).toContain("저장");
    expect(r.totalTime).toBeGreaterThanOrEqual(2000);
  });

  it("filter — filterResolver=true → step 실행", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "filter", condition: "amount > 0", step: step("생산"),
      })]),
      initialEvent: { eventKey: "start" },
      filterResolver: () => true,
    });
    expect(r.facetTrace).toContain("생산");
  });

  it("filter — filterResolver=false → filtered", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "filter", condition: "amount > 0", step: step("생산"),
      })]),
      initialEvent: { eventKey: "start" },
      filterResolver: () => false,
    });
    expect(r.facetTrace).toEqual([]);
    expect(r.steps.some(s => s.status === "filtered")).toBe(true);
  });

  // ── 안정화 ──────────────────────────────────────────

  it("circuit-breaker — step 실행", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "circuit-breaker", step: step("관리"),
        failureThreshold: 5, cooldown: 3000,
      })]),
      initialEvent: { eventKey: "start" },
    });
    expect(r.facetTrace).toContain("관리");
  });

  it("throttle — step 실행", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "throttle", step: step("소비"), rate: 10, interval: 1000,
      })]),
      initialEvent: { eventKey: "start" },
    });
    expect(r.facetTrace).toContain("소비");
  });

  it("debounce — wait 경과 + step 실행", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "debounce", step: step("소비"), wait: 500,
      })]),
      initialEvent: { eventKey: "start", timestamp: 0 },
    });
    expect(r.facetTrace).toContain("소비");
    expect(r.totalTime).toBeGreaterThanOrEqual(500);
  });

  // ── 데이터 변환 ─────────────────────────────────────

  it("split — itemFlow 실행", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "split", splitBy: "items", itemFlow: step("생산"),
      })]),
      initialEvent: { eventKey: "start" },
    });
    expect(r.facetTrace).toContain("생산");
  });

  it("enrich — step 실행 + timeout 경과", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "enrich", source: "userService", mergeField: "user",
        step: step("생산"), timeout: 1000,
      })]),
      initialEvent: { eventKey: "start", timestamp: 0 },
    });
    expect(r.facetTrace).toContain("생산");
    expect(r.totalTime).toBeGreaterThanOrEqual(1000);
  });

  // ── 관측 ────────────────────────────────────────────

  it("tap — observe + step 모두 실행", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "tap",
        observe: step("관리", "log"),
        step: step("생산", "main"),
      })]),
      initialEvent: { eventKey: "start" },
    });
    expect(r.steps.find(s => s.eventKey === "log")).toBeDefined();
    expect(r.steps.find(s => s.eventKey === "main")).toBeDefined();
  });

  // ── 스트리밍 ────────────────────────────────────────

  it("resequence — step 실행", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "resequence", orderBy: "seq", windowSize: 10, step: step("소비"),
      })]),
      initialEvent: { eventKey: "start" },
    });
    expect(r.facetTrace).toContain("소비");
  });

  it("window (tumbling) — body 실행", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "window", type: "tumbling", size: 1000, body: step("관리"),
      })]),
      initialEvent: { eventKey: "start" },
    });
    expect(r.facetTrace).toContain("관리");
  });

  // ── 상태 ────────────────────────────────────────────

  it("dedup — filterResolver=true → step 실행", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "dedup", keyField: "id", step: step("생산"),
      })]),
      initialEvent: { eventKey: "start" },
      filterResolver: () => true,
    });
    expect(r.facetTrace).toContain("생산");
  });

  it("dedup — filterResolver=false → filtered (중복)", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "dedup", keyField: "id", step: step("생산"),
      })]),
      initialEvent: { eventKey: "start" },
      filterResolver: () => false,
    });
    expect(r.steps.some(s => s.status === "filtered")).toBe(true);
  });

  it("correlation — onMatch 실행", () => {
    const r = simulate({
      graph: makeGraph([makePipe("p", "start", {
        kind: "correlation",
        requestEvent: "req", responseEvent: "res",
        correlationKey: "id",
        onMatch: step("생산"),
      })]),
      initialEvent: { eventKey: "start" },
    });
    expect(r.facetTrace).toContain("생산");
  });
});

describe("ConnectionKind 시뮬레이션 — 8종", () => {
  it("next — 순차 파이프 실행", () => {
    const r = simulate({
      graph: makeGraph(
        [makePipe("a", "start", step("소비")), makePipe("b", "b_trigger", step("생산"))],
        [{ from: "a", to: "b", kind: "next" }],
      ),
      initialEvent: { eventKey: "start" },
    });
    expect(r.pipeTrace).toEqual(["a", "b"]);
  });

  it("conditional — filterResolver=true → 연결 실행", () => {
    const r = simulate({
      graph: makeGraph(
        [makePipe("a", "start", step("소비")), makePipe("b", "b_trigger", step("생산"))],
        [{ from: "a", to: "b", kind: "conditional", condition: "ok" }],
      ),
      initialEvent: { eventKey: "start" },
      filterResolver: () => true,
    });
    expect(r.pipeTrace).toContain("b");
  });

  it("conditional — filterResolver=false → 연결 안 됨", () => {
    const r = simulate({
      graph: makeGraph(
        [makePipe("a", "start", step("소비")), makePipe("b", "b_trigger", step("생산"))],
        [{ from: "a", to: "b", kind: "conditional", condition: "ok" }],
      ),
      initialEvent: { eventKey: "start" },
      filterResolver: () => false,
    });
    expect(r.pipeTrace).toEqual(["a"]);
  });

  it("event — produces → trigger 자동 연결", () => {
    const r = simulate({
      graph: makeGraph(
        [
          makePipe("a", "start", step("생산"), ["order_confirmed"]),
          makePipe("b", "order_confirmed", step("관리")),
        ],
      ),
      initialEvent: { eventKey: "start" },
    });
    expect(r.pipeTrace).toEqual(["a", "b"]);
  });

  it("fan-out — 1:N 동시 실행", () => {
    const r = simulate({
      graph: makeGraph(
        [
          makePipe("a", "start", step("소비")),
          makePipe("b", "b_t", step("관리")),
          makePipe("c", "c_t", step("저장")),
        ],
        [{ from: "a", to: ["b", "c"], kind: "fan-out" }],
      ),
      initialEvent: { eventKey: "start" },
    });
    expect(r.pipeTrace).toContain("b");
    expect(r.pipeTrace).toContain("c");
  });

  it("join — N:1 합류 실행", () => {
    const r = simulate({
      graph: makeGraph(
        [
          makePipe("a", "start", step("소비")),
          makePipe("b", "b_t", step("관리")),
          makePipe("c", "c_t", step("저장")),
          makePipe("d", "d_t", step("생산")),
        ],
        [
          { from: "a", to: ["b", "c"], kind: "fan-out" },
          { from: ["b", "c"], to: "d", kind: "join" },
        ],
      ),
      initialEvent: { eventKey: "start" },
    });
    expect(r.pipeTrace).toContain("d");
  });

  it("feedback — 자기 참조 이벤트로 무한 루프 + maxSteps 보호", () => {
    const r = simulate({
      graph: makeGraph(
        [makePipe("a", "loop_event", step("관리"), ["loop_event"])],
      ),
      initialEvent: { eventKey: "loop_event" },
      maxSteps: 5,
    });
    expect(r.status).toBe("max-steps-reached");
    expect(r.totalSteps).toBeGreaterThanOrEqual(5);
  });
});

describe("복합 시나리오", () => {
  it("주문: sequence + branch + retry(fallback) + finally + emit + fan-out + join", () => {
    const orderPipe = makePipe("order", "submit", {
      kind: "sequence",
      steps: [
        step("소비", "input"),
        { kind: "branch", condition: "stock", paths: [
          step("생산", "confirmed"),
          step("생산", "waitlisted"),
        ]},
        step("저장"),
      ],
    }, ["order_done"]);

    const paymentPipe = makePipe("payment", "pay", {
      kind: "finally",
      body: {
        kind: "retry", maxAttempts: 3,
        step: { kind: "fallback",
          try: step("관리", "pg_a"),
          catch: step("관리", "pg_b"),
        },
      },
      cleanup: step("저장", "log"),
    });

    const inventoryPipe = makePipe("inventory", "inv", step("관리", "check_stock"));

    const notifyPipe = makePipe("notify", "done", {
      kind: "tap",
      observe: step("관리", "metric"),
      step: { kind: "emit", eventKey: "notification" },
    });

    const graph = makeGraph(
      [orderPipe, paymentPipe, inventoryPipe, notifyPipe],
      [
        { from: "order", to: ["payment", "inventory"], kind: "fan-out" },
        { from: ["payment", "inventory"], to: "notify", kind: "join" },
      ],
    );

    // 정상 경로
    const r1 = simulate({
      graph,
      initialEvent: { eventKey: "submit" },
      branchResolver: () => 0,
      failureResolver: () => true,
    });
    expect(r1.status).toBe("complete");
    expect(r1.pipeTrace).toContain("order");
    expect(r1.pipeTrace).toContain("payment");
    expect(r1.pipeTrace).toContain("inventory");
    expect(r1.pipeTrace).toContain("notify");
    expect(r1.producedEvents.map(e => e.eventKey)).toContain("notification");

    // 실패 경로 (PG_A 실패 → PG_B)
    const r2 = simulate({
      graph,
      initialEvent: { eventKey: "submit" },
      branchResolver: () => 0,
      failureResolver: () => false,
    });
    expect(r2.status).toBe("complete");
    expect(r2.steps.some(s => s.eventKey === "pg_b")).toBe(true);
  });
});
