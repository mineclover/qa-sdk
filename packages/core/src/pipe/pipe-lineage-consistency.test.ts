// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * 정적 계보 ↔ 시뮬레이션 계보 교차 일관성 검증.
 *
 * 같은 PipeSpec에 deriveStaticLineage + extractLineageFromSimulation을 실행,
 * column/transform 집합이 일치하는지 확인.
 *
 * 주의: schemaId는 의도적으로 다를 수 있음 (accesses 유무에 따라).
 * 비교 대상: (target.column, sources[].column, transform) 트리플.
 */

import { describe, it, expect } from "vitest";
import { deriveStaticLineage } from "./pipe-lineage.js";
import { extractLineageFromSimulation } from "./pipe-bridge.js";
import { simulate } from "./pipe-simulate.js";
import type { PipeSpec, PipeGraph, PipeFlow, PipeStep } from "../types/pipe-spec.js";
import type { FieldLineage } from "../types/data-schema.js";

// ── 헬퍼 ──────────────────────────────────────────────

function step(facet: string, opts?: {
  consumes?: Record<string, { type: string; required: boolean }>;
  produces?: Record<string, { type: string; required: boolean }>;
  lineageHints?: Record<string, { sources: string[]; transform: "direct" | "compute" }>;
}): PipeStep {
  return {
    kind: "step",
    facet,
    dataContract: opts ? {
      consumes: opts.consumes,
      produces: opts.produces,
      lineageHints: opts.lineageHints,
    } : undefined,
  };
}

const f = (name: string) => ({ type: "string", required: true as const });
const n = (name: string) => ({ type: "number", required: true as const });

function makePipe(flow: PipeFlow): PipeSpec {
  return { pipeId: "test-pipe", version: "v1", trigger: { eventKey: "start" }, flow };
}

function makeGraph(pipe: PipeSpec): PipeGraph {
  return { graphId: "g1", version: "v1", pipes: [pipe], connections: [], entryPipeId: pipe.pipeId };
}

/** FieldLineage를 (target.column, sources[].column, transform) 트리플로 정규화 */
function normalizeLineage(lineage: FieldLineage): string {
  const srcCols = lineage.sources.map(s => s.column).sort().join(",");
  return `${lineage.target.column}←[${srcCols}]:${lineage.transform}`;
}

function normalizeSet(lineages: readonly FieldLineage[]): string[] {
  return [...new Set(lineages.map(normalizeLineage))].sort();
}

// ── 교차 일관성 검증 ────────────────────────────────

describe("정적 ↔ 시뮬 교차 일관성", () => {
  it("단일 step — lineageHints 일치", () => {
    const pipe = makePipe(step("합산", {
      consumes: { a: n("a"), b: n("b") },
      produces: { c: n("c") },
      lineageHints: { c: { sources: ["a", "b"], transform: "compute" } },
    }));

    const staticL = deriveStaticLineage(pipe.flow, pipe.pipeId);
    const simResult = simulate({ graph: makeGraph(pipe), initialEvent: { eventKey: "start" } });
    const simL = extractLineageFromSimulation(simResult, [pipe]);

    expect(normalizeSet(staticL)).toEqual(normalizeSet(simL.getAll()));
  });

  it("2-step sequence — 내부 계보 + 체인 일치", () => {
    const pipe = makePipe({
      kind: "sequence",
      steps: [
        step("검증", {
          consumes: { raw: f("raw") },
          produces: { validated: f("validated") },
          lineageHints: { validated: { sources: ["raw"], transform: "compute" } },
        }),
        step("결제", {
          consumes: { validated: f("validated") },
          produces: { paid: f("paid") },
          lineageHints: { paid: { sources: ["validated"], transform: "compute" } },
        }),
      ],
    });

    const staticL = deriveStaticLineage(pipe.flow, pipe.pipeId);
    const simResult = simulate({ graph: makeGraph(pipe), initialEvent: { eventKey: "start" } });
    const simL = extractLineageFromSimulation(simResult, [pipe]);

    expect(normalizeSet(staticL)).toEqual(normalizeSet(simL.getAll()));
  });

  it("소비 구분 — b 소비, a만 기여 — 양쪽 일치", () => {
    const pipe = makePipe(step("필터", {
      consumes: { a: f("a"), b: f("b") },
      produces: { c: f("c") },
      lineageHints: { c: { sources: ["a"], transform: "direct" } },
    }));

    const staticL = deriveStaticLineage(pipe.flow, pipe.pipeId);
    const simResult = simulate({ graph: makeGraph(pipe), initialEvent: { eventKey: "start" } });
    const simL = extractLineageFromSimulation(simResult, [pipe]);

    // 양쪽 모두 c←[a]:direct
    expect(normalizeSet(staticL)).toEqual(normalizeSet(simL.getAll()));
  });

  it("transition-scope body sequence — 양쪽 일치", () => {
    const pipe = makePipe({
      kind: "transition-scope",
      transitionId: "transfer",
      events: ["debit", "credit"],
      body: {
        kind: "sequence",
        steps: [
          step("출금", {
            consumes: { amount: n("amount") },
            produces: { debitResult: f("debitResult") },
            lineageHints: { debitResult: { sources: ["amount"], transform: "compute" } },
          }),
          step("입금", {
            consumes: { debitResult: f("debitResult") },
            produces: { creditResult: f("creditResult") },
            lineageHints: { creditResult: { sources: ["debitResult"], transform: "compute" } },
          }),
        ],
      },
    });

    const staticL = deriveStaticLineage(pipe.flow, pipe.pipeId);
    const simResult = simulate({ graph: makeGraph(pipe), initialEvent: { eventKey: "start" } });
    const simL = extractLineageFromSimulation(simResult, [pipe]);

    expect(normalizeSet(staticL)).toEqual(normalizeSet(simL.getAll()));
  });

  it("hints 없음 — 이름 매칭 추론도 양쪽 일치", () => {
    const pipe = makePipe({
      kind: "sequence",
      steps: [
        step("수집", {
          produces: { data: f("data") },
        }),
        step("처리", {
          consumes: { data: f("data") },
          produces: { data: f("data") },
          // lineageHints 없음 → 이름 매칭
        }),
      ],
    });

    const staticL = deriveStaticLineage(pipe.flow, pipe.pipeId);
    const simResult = simulate({ graph: makeGraph(pipe), initialEvent: { eventKey: "start" } });
    const simL = extractLineageFromSimulation(simResult, [pipe]);

    expect(normalizeSet(staticL)).toEqual(normalizeSet(simL.getAll()));
  });
});
