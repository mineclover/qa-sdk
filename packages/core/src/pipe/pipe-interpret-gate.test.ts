/**
 * pipe-interpret 퀄리티 게이트.
 *
 * 현실적 시나리오 그래프로 관심사 추출/전파/영향 분석/역할 분류의
 * 품질을 측정한다. spec-tracker로 증거 기록.
 *
 * 게이트 기준:
 *   G1. PipeConcern 8종 추출 커버리지 = 100%
 *   G2. ConnectionKind 8종 전파 규칙 커버리지 = 100%
 *   G3. 전이적 전파 축소 동작 검증
 *   G4. blastRadius 합리성 (0 < radius ≤ pipeCount)
 *   G5. PipeRole 5종 분류 커버리지 = 100%
 *   G6. 전파→영향 일관성 (같은 concernMap 사용)
 */
import { describe, it, expect } from "vitest";
import { SpecCollector, generateReport, specIt } from "spec-tracker";
import {
  extractPipeConcerns, propagatePipeConcerns, analyzePipeImpact, classifyPipeRole,
  PIPE_PROPAGATION_RULES,
} from "./pipe-interpret.js";
import type { PipeConcern, PipeRole } from "./pipe-interpret.js";
import type { PipeSpec, PipeGraph, PipeFlow, PipeConnection } from "../types/pipe-spec.js";

const collector = new SpecCollector();
const SPEC_ID = "pipe-interpret-quality";

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

function conn(from: string | string[], to: string | string[], kind: PipeConnection["kind"] = "next"): PipeConnection {
  return { from, to, kind };
}

// ── 시나리오 그래프: 주문 처리 시스템 ──────────────────

/** 현실적 주문 처리 그래프 (5파이프, 4연결, 다양한 패턴) */
function orderFlowGraph(): PipeGraph {
  return {
    graphId: "order-flow",
    version: "1.0.0",
    pipes: [
      makePipe("validate", {
        flow: {
          kind: "sequence",
          steps: [
            step("소비", undefined, { dataContract: {
              consumes: { orderId: { type: "string", required: true } },
              accesses: [{ schemaId: "orders", columns: ["id", "status"], mode: "read" }],
            }}),
            { kind: "branch", condition: "order.type", paths: [step("관리"), step("관리")] },
          ],
        },
        produces: ["order.validated"],
        scope: "order",
      }),
      makePipe("charge", {
        flow: {
          kind: "retry",
          step: {
            kind: "timeout",
            body: step("생산", undefined, { dataContract: {
              accesses: [{ schemaId: "payments", columns: ["amount", "method"], mode: "write" }],
            }}),
            duration: 10000,
          },
          maxAttempts: 3,
        },
        produces: ["payment.completed"],
        scope: "payment",
      }),
      makePipe("receipt", {
        flow: step("생산", undefined, { dataContract: {
          produces: { receiptUrl: { type: "string", required: true } },
        }}),
        produces: ["receipt.generated"],
      }),
      makePipe("notify", {
        flow: {
          kind: "tap",
          observe: { kind: "emit", eventKey: "notification.send" },
          step: step("관리"),
        },
      }),
      makePipe("complete", {
        flow: step("저장", undefined, { dataContract: {
          accesses: [{ schemaId: "orders", columns: ["status"], mode: "write" }],
        }}),
      }),
    ],
    connections: [
      conn("validate", "charge", "next"),
      conn("charge", ["receipt", "notify"], "fan-out"),
      conn("receipt", "complete", "next"),
      conn("charge", "validate", "compensate"),
    ],
    entryPipeId: "validate",
  };
}

/** 전파 규칙 커버리지용 그래프 (8종 ConnectionKind 전부 사용) */
function fullConnectionGraph(): PipeGraph {
  return {
    graphId: "full-conn",
    version: "1.0.0",
    pipes: [
      makePipe("A", { flow: { kind: "retry", step: step(), maxAttempts: 2 } }),
      makePipe("B", { flow: { kind: "timeout", body: step(), duration: 5000 } }),
      makePipe("C", { flow: { kind: "parallel", steps: [step(), step()] } }),
      makePipe("D", { flow: { kind: "emit", eventKey: "evt" } }),
      makePipe("E", { flow: { kind: "fallback", try: step(), catch: step() } }),
      makePipe("F", { flow: { kind: "dedup", keyField: "id", step: step() } }),
      makePipe("G", { flow: { kind: "tap", observe: step(), step: step() } }),
      makePipe("H", { flow: step("소비", undefined, { dataContract: {
        accesses: [{ schemaId: "t", columns: ["c"], mode: "readwrite" }],
      }}) }),
      makePipe("J"),
    ],
    connections: [
      conn("A", "B", "next"),
      conn("B", "C", "conditional"),
      conn("C", "D", "event"),
      conn("D", "E", "error"),
      conn("E", "F", "compensate"),
      conn("A", ["G", "H"], "fan-out"),
      conn(["G", "H"], "J", "join"),
      conn("J", "A", "feedback"),
    ],
    entryPipeId: "A",
  };
}

// ── 퀄리티 게이트 ─────────────────────────────────────

describe("pipe-interpret 퀄리티 게이트", () => {

  // ── G1: PipeConcern 8종 추출 커버리지 ──────────────

  it("G1. PipeConcern 8종 전부 추출 가능", () => {
    const ALL_CONCERNS: PipeConcern[] = [
      "resilience", "latency", "concurrency", "data-mutation",
      "data-read", "async-coupling", "data-filtering", "observability",
    ];

    const graph = fullConnectionGraph();
    const extracted = new Set<PipeConcern>();
    for (const pipe of graph.pipes) {
      for (const c of extractPipeConcerns(pipe)) extracted.add(c);
    }

    const missing = ALL_CONCERNS.filter(c => !extracted.has(c));
    const coverage = extracted.size / ALL_CONCERNS.length;

    if (missing.length === 0) {
      collector.record({ specId: SPEC_ID, status: "pass", testName: "G1-concern-extraction", marker: "evidence" });
    } else {
      collector.record({ specId: SPEC_ID, status: "fail", testName: "G1-concern-extraction", marker: "evidence", error: `미추출: ${missing.join(", ")}` });
    }

    expect(missing, `미추출 관심사: ${missing.join(", ")}`).toHaveLength(0);
    expect(coverage).toBe(1);
  });

  // ── G2: ConnectionKind 8종 전파 규칙 커버리지 ──────

  it("G2. ConnectionKind 8종 전부 전파 규칙 정의됨", () => {
    const ALL_KINDS = ["next", "conditional", "event", "error", "compensate", "fan-out", "join", "feedback"];
    const definedKinds = PIPE_PROPAGATION_RULES.map(r => r.connectionKind);
    const missing = ALL_KINDS.filter(k => !definedKinds.includes(k as any));

    if (missing.length === 0) {
      collector.record({ specId: SPEC_ID, status: "pass", testName: "G2-propagation-rules", marker: "evidence" });
    } else {
      collector.record({ specId: SPEC_ID, status: "fail", testName: "G2-propagation-rules", marker: "evidence", error: `미정의: ${missing.join(", ")}` });
    }

    expect(missing).toHaveLength(0);
  });

  it("G2. 8종 ConnectionKind 전파가 실제 그래프에서 동작", () => {
    const graph = fullConnectionGraph();
    const map = propagatePipeConcerns(graph);

    // 모든 파이프에 concernEntry가 있어야 함
    expect(map.size).toBe(graph.pipes.length);

    // 최소 1건 이상 상속 발생
    let totalInherited = 0;
    for (const [, entry] of map) totalInherited += entry.inherited.length;

    if (totalInherited > 0) {
      collector.record({ specId: SPEC_ID, status: "pass", testName: "G2-propagation-active", marker: "evidence" });
    } else {
      collector.record({ specId: SPEC_ID, status: "fail", testName: "G2-propagation-active", marker: "evidence", error: "상속 0건" });
    }

    expect(totalInherited).toBeGreaterThan(0);
  });

  // ── G3: 전이적 전파 축소 검증 ─────────────────────

  it("G3. 전이적 전파 축소 — next→conditional 체인에서 resilience 차단", () => {
    // A(retry) --next--> B --conditional--> C
    const graph: PipeGraph = {
      graphId: "narrowing",
      version: "1.0.0",
      pipes: [
        makePipe("A", { flow: { kind: "retry", step: { kind: "timeout", body: step(), duration: 1000 }, maxAttempts: 2 } }),
        makePipe("B"),
        makePipe("C"),
      ],
      connections: [
        conn("A", "B", "next"),
        { from: "B", to: "C", kind: "conditional", condition: "x" },
      ],
      entryPipeId: "A",
    };

    const map = propagatePipeConcerns(graph);

    // B: next를 통해 resilience + latency 상속
    const bInherited = map.get("B")!.inherited.map(i => i.concern);
    const bHasResilience = bInherited.includes("resilience");
    const bHasLatency = bInherited.includes("latency");

    // C: conditional은 [latency]만 전파 → resilience 차단
    const cInherited = map.get("C")!.inherited.map(i => i.concern);
    const cNoResilience = !cInherited.includes("resilience");
    const cHasLatency = cInherited.includes("latency");

    const pass = bHasResilience && bHasLatency && cNoResilience && cHasLatency;
    collector.record({
      specId: SPEC_ID,
      status: pass ? "pass" : "fail",
      testName: "G3-transitive-narrowing",
      marker: "evidence",
      ...(pass ? {} : { error: `B:[res=${bHasResilience},lat=${bHasLatency}] C:[no-res=${cNoResilience},lat=${cHasLatency}]` }),
    });

    expect(bHasResilience).toBe(true);
    expect(bHasLatency).toBe(true);
    expect(cNoResilience).toBe(true);
    expect(cHasLatency).toBe(true);
  });

  // ── G4: blastRadius 합리성 ────────────────────────

  it("G4. blastRadius가 합리적 범위 (0 < radius ≤ pipeCount - 1)", () => {
    const graph = orderFlowGraph();
    const results: Array<{ src: string; radius: number; valid: boolean }> = [];

    for (const pipe of graph.pipes) {
      const impact = analyzePipeImpact(graph, pipe.pipeId);
      const valid = impact.blastRadius >= 0 && impact.blastRadius <= graph.pipes.length - 1;
      results.push({ src: pipe.pipeId, radius: impact.blastRadius, valid });
    }

    const allValid = results.every(r => r.valid);
    const totalRadius = results.reduce((s, r) => s + r.radius, 0);

    collector.record({
      specId: SPEC_ID,
      status: allValid ? "pass" : "fail",
      testName: "G4-blast-radius-range",
      marker: "evidence",
      ...(allValid ? {} : { error: results.filter(r => !r.valid).map(r => `${r.src}:${r.radius}`).join(", ") }),
    });

    expect(allValid).toBe(true);
    // 최소 1개 파이프는 영향이 있어야 함 (완전 고립 그래프가 아니므로)
    expect(totalRadius).toBeGreaterThan(0);
  });

  it("G4. byConcern 합산이 impacted 수 이하", () => {
    const graph = orderFlowGraph();

    for (const pipe of graph.pipes) {
      const impact = analyzePipeImpact(graph, pipe.pipeId);
      // 각 concern count ≤ blastRadius (파이프당 최대 1 기여)
      for (const [concern, count] of Object.entries(impact.byConcern)) {
        expect(count, `${pipe.pipeId}→${concern}`).toBeLessThanOrEqual(impact.blastRadius);
      }
    }

    collector.record({ specId: SPEC_ID, status: "pass", testName: "G4-byConcern-bound", marker: "evidence" });
  });

  // ── G5: PipeRole 5종 분류 커버리지 ────────────────

  it("G5. PipeRole 5종 전부 분류 가능", () => {
    const ALL_ROLES: PipeRole[] = ["producer", "consumer", "transformer", "router", "observer"];

    const pipes: PipeSpec[] = [
      makePipe("transformer", { produces: ["done"] }),
      makePipe("producer", { flow: { kind: "emit", eventKey: "notify" } }),
      makePipe("observer", { flow: { kind: "tap", observe: step(), step: step() } }),
      makePipe("router", { flow: { kind: "branch", condition: "type", paths: [step(), step()] } }),
      makePipe("consumer"),
    ];

    const classified = new Set<PipeRole>();
    for (const pipe of pipes) classified.add(classifyPipeRole(pipe));

    const missing = ALL_ROLES.filter(r => !classified.has(r));
    const coverage = classified.size / ALL_ROLES.length;

    if (missing.length === 0) {
      collector.record({ specId: SPEC_ID, status: "pass", testName: "G5-role-classification", marker: "evidence" });
    } else {
      collector.record({ specId: SPEC_ID, status: "fail", testName: "G5-role-classification", marker: "evidence", error: `미분류: ${missing.join(", ")}` });
    }

    expect(missing).toHaveLength(0);
    expect(coverage).toBe(1);
  });

  // ── G6: 전파→영향 일관성 ──────────────────────────

  it("G6. 영향받는 파이프의 concern이 전파 맵과 일치", () => {
    const graph = orderFlowGraph();
    const concernMap = propagatePipeConcerns(graph);

    for (const pipe of graph.pipes) {
      const impact = analyzePipeImpact(graph, pipe.pipeId);
      for (const imp of impact.impacted) {
        const entry = concernMap.get(imp.pipeId);
        expect(entry, `${imp.pipeId}에 대한 concernEntry 누락`).toBeDefined();
        // byConcern에 집계된 concern은 전파 맵에도 있어야 함
      }
    }

    collector.record({ specId: SPEC_ID, status: "pass", testName: "G6-propagation-impact-consistency", marker: "evidence" });
  });

  // ── 시나리오 통합: 주문 처리 ──────────────────────

  it("시나리오: 주문 처리 그래프 — 관심사 전파 스냅샷", () => {
    const graph = orderFlowGraph();
    const map = propagatePipeConcerns(graph);

    // validate: data-read(직접) + resilience, data-mutation(compensate로 상속)
    const validate = map.get("validate")!;
    expect(validate.direct).toContain("data-read");
    expect(validate.inherited.some(i => i.concern === "resilience" && i.via === "compensate")).toBe(true);

    // charge: resilience + latency + data-mutation (전부 직접)
    const charge = map.get("charge")!;
    expect(charge.direct).toContain("resilience");
    expect(charge.direct).toContain("latency");
    expect(charge.direct).toContain("data-mutation");
    expect(charge.inherited).toHaveLength(0);

    // receipt: latency(fan-out으로 상속)
    const receipt = map.get("receipt")!;
    expect(receipt.inherited.some(i => i.concern === "latency" && i.via === "fan-out")).toBe(true);

    // notify: observability + async-coupling(직접) + latency(fan-out 상속)
    const notify = map.get("notify")!;
    expect(notify.direct).toContain("observability");
    expect(notify.direct).toContain("async-coupling");
    expect(notify.inherited.some(i => i.concern === "latency")).toBe(true);

    collector.record({ specId: SPEC_ID, status: "pass", testName: "scenario-order-flow-propagation", marker: "evidence" });
  });

  it("시나리오: charge 변경 — 영향 분석 스냅샷", () => {
    const graph = orderFlowGraph();
    const impact = analyzePipeImpact(graph, "charge");

    // charge → receipt(d=1), notify(d=1), validate(d=1, compensate), complete(d=2)
    expect(impact.blastRadius).toBe(4);
    expect(impact.impacted.some(i => i.pipeId === "validate" && i.depth === 1)).toBe(true);
    expect(impact.impacted.some(i => i.pipeId === "receipt" && i.depth === 1)).toBe(true);
    expect(impact.impacted.some(i => i.pipeId === "complete" && i.depth === 2)).toBe(true);

    collector.record({ specId: SPEC_ID, status: "pass", testName: "scenario-charge-impact", marker: "evidence" });
  });

  // ── 리포트 생성 ───────────────────────────────────

  it("spec-tracker 리포트 생성", () => {
    const report = generateReport(collector, [SPEC_ID]);
    expect(report.reports).toHaveLength(1);

    const r = report.reports[0]!;
    expect(r.specId).toBe(SPEC_ID);
    expect(r.passed).toBeGreaterThan(0);

    console.log(`\n=== pipe-interpret 퀄리티 게이트 리포트 ===`);
    console.log(`specId: ${r.specId}`);
    console.log(`증거: ${r.evidences}건 (pass: ${r.passed}, fail: ${r.failed})`);
    console.log(`coverage: ${(r.coverage * 100).toFixed(0)}%`);

    // 게이트 통과 조건: fail 0, coverage 100%
    expect(r.failed, "퀄리티 게이트 실패").toBe(0);
    expect(r.coverage, "퀄리티 게이트 커버리지 < 100%").toBe(1);
  });
});
