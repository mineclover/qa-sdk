/**
 * pipe-zoom 테스트 공유 fixture
 *
 * 3개 패싯 테스트 파일(view, layout, style)에서 공유.
 */

import type { PipeSpec, PipeGraph, PipeConnection } from "../types/pipe-spec.js";
import { step } from "./pipe-fixtures.js";

export function makePipe(id: string, overrides?: Partial<PipeSpec>): PipeSpec {
  return {
    pipeId: id,
    version: "1.0.0",
    trigger: { eventKey: `${id}_trigger` },
    flow: step(),
    ...overrides,
  };
}

export function conn(from: string, to: string, kind: PipeConnection["kind"] = "next"): PipeConnection {
  return { from, to, kind };
}

/** A → B → C → D → E → F (6노드 체인) */
export function chainGraph(): PipeGraph {
  return {
    graphId: "chain",
    version: "1.0.0",
    pipes: [
      makePipe("A"),
      makePipe("B", {
        flow: {
          kind: "sequence",
          steps: [
            { kind: "step", facet: "소비", dataContract: {
              consumes: { orderId: { type: "string", required: true } },
            }},
            { kind: "step", facet: "관리" },
          ],
        },
      }),
      makePipe("C"),
      makePipe("D", {
        flow: {
          kind: "step",
          facet: "저장",
          dataContract: {
            produces: { result: { type: "number", required: true } },
            accesses: [{ schemaId: "orders", columns: ["id"], mode: "write" as const }],
          },
        },
      }),
      makePipe("E"),
      makePipe("F"),
    ],
    connections: [
      conn("A", "B"),
      conn("B", "C"),
      conn("C", "D"),
      conn("D", "E"),
      conn("E", "F"),
    ],
    entryPipeId: "A",
  };
}

/** scope 클러스터: {A,B} scope="auth", {C,D,E} scope="payment" */
export function scopeGraph(): PipeGraph {
  return {
    graphId: "scoped",
    version: "1.0.0",
    pipes: [
      makePipe("A", { scope: "auth" }),
      makePipe("B", { scope: "auth" }),
      makePipe("C", { scope: "payment" }),
      makePipe("D", { scope: "payment" }),
      makePipe("E", { scope: "payment" }),
    ],
    connections: [
      conn("A", "B"),
      conn("B", "C"),
      conn("C", "D"),
      conn("D", "E"),
    ],
    entryPipeId: "A",
  };
}

/** 분기 그래프: A → B → (C | D) → E */
export function branchGraph(): PipeGraph {
  return {
    graphId: "branch",
    version: "1.0.0",
    pipes: [
      makePipe("A"),
      makePipe("B", {
        flow: { kind: "branch", condition: "type", paths: [step("생산"), step("관리")] },
      }),
      makePipe("C"),
      makePipe("D"),
      makePipe("E"),
    ],
    connections: [
      conn("A", "B"),
      { from: "B", to: "C", kind: "conditional" as const, condition: "type === 'a'" },
      { from: "B", to: "D", kind: "conditional" as const, condition: "type === 'b'" },
      conn("C", "E"),
      conn("D", "E"),
    ],
    entryPipeId: "A",
  };
}

/** 피드백 루프: A → B → C → A + C → D */
export function loopGraph(): PipeGraph {
  return {
    graphId: "loop",
    version: "1.0.0",
    pipes: [
      makePipe("A"),
      makePipe("B"),
      makePipe("C"),
      makePipe("D"),
    ],
    connections: [
      conn("A", "B"),
      conn("B", "C"),
      { from: "C", to: "A", kind: "feedback" as const },
      conn("C", "D"),
    ],
    entryPipeId: "A",
  };
}
