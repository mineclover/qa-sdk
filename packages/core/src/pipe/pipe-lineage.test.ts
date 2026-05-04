// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

import { describe, it, expect } from "vitest";
import { deriveStaticLineage, deriveStaticLineageWithDiagnostics, summarizeFlowLineage, validateStaticLineage, findFieldOrigin, deriveGraphLineage, summarizeGraphLineage, findFieldOriginInGraph, lineageId, serializeLineage, deserializeLineage, diffLineage } from "./pipe-lineage.js";
import type { PipeFlow, PipeStep, PipeSpec, PipeGraph } from "../types/pipe-spec.js";
import { BindingRegistry } from "../data-object/registry.js";

// ── 헬퍼 ──────────────────────────────────────────────

function step(facet: string, opts?: {
  consumes?: Record<string, { type: string; required: boolean }>;
  produces?: Record<string, { type: string; required: boolean }>;
  lineageHints?: Record<string, { sources: string[]; transform: "direct" | "compute" | "derive" | "aggregate" }>;
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

// ── 핵심 증명 1: a + b → c 계보 [a, b] ──────────────

describe("정적 계보 파생 — deriveStaticLineage", () => {
  it("a + b → c (양쪽 기여) — c의 계보에 a, b 포함", () => {
    const flow: PipeFlow = step("합산", {
      consumes: { a: n("a"), b: n("b") },
      produces: { c: n("c") },
      lineageHints: {
        c: { sources: ["a", "b"], transform: "compute" },
      },
    });

    const lineages = deriveStaticLineage(flow);
    expect(lineages).toHaveLength(1);
    expect(lineages[0].target.column).toBe("c");
    expect(lineages[0].sources.map(s => s.column).toSorted()).toEqual(["a", "b"]);
    expect(lineages[0].transform).toBe("compute");
  });

  // ── 핵심 증명 2: b 소비, a만 통과 → c 계보 [a] ────

  it("a만 통과, b 소비 — c의 계보에 a만 포함", () => {
    const flow: PipeFlow = step("필터", {
      consumes: { a: f("a"), b: f("b") },
      produces: { c: f("c") },
      lineageHints: {
        c: { sources: ["a"], transform: "direct" },
        // b는 sources에 없음 → 소비됨 (조건 판단에만 사용)
      },
    });

    const lineages = deriveStaticLineage(flow);
    expect(lineages).toHaveLength(1);
    expect(lineages[0].target.column).toBe("c");
    expect(lineages[0].sources.map(s => s.column)).toEqual(["a"]);
    // b는 계보에 없음
    expect(lineages[0].sources.some(s => s.column === "b")).toBe(false);
  });

  // ── hints 없을 때 이름 매칭 추론 ──────────────────

  it("lineageHints 없음, 단일 step — pass-through는 chain에서 처리, step 내부 계보 없음", () => {
    const flow: PipeFlow = step("통과", {
      consumes: { orderId: f("orderId"), extra: f("extra") },
      produces: { orderId: f("orderId") },
      // lineageHints 없음 → step 내부에서는 self-reference 방지로 생략, chain에서 처리
    });

    const lineages = deriveStaticLineage(flow);
    expect(lineages).toHaveLength(0); // 단일 step은 chain 없으므로 계보 없음
  });

  it("lineageHints 없음, sequence — chain에서 이름 매칭 처리", () => {
    const flow: PipeFlow = {
      kind: "sequence",
      steps: [
        step("A", { produces: { data: f("data") } }),
        step("B", { consumes: { data: f("data") }, produces: { data: f("data") } }),
      ],
    };

    const lineages = deriveStaticLineage(flow);
    // chain: A.data → B.data
    const chain = lineages.filter(l => l.stepPath.includes("chain"));
    expect(chain).toHaveLength(1);
    expect(chain[0].target.column).toBe("data");
  });

  it("produces에만 있고 consumes에 없음 — 새로 생성된 필드, 계보 없음", () => {
    const flow: PipeFlow = step("생성", {
      produces: { timestamp: f("timestamp") },
    });

    const lineages = deriveStaticLineage(flow);
    expect(lineages).toHaveLength(0);
  });
});

// ── 핵심 증명 3: sequence 체인 추적 ──────────────────

describe("정적 계보 — sequence 체인", () => {
  it("A.produces → B.consumes → B.produces 체인 추적", () => {
    const flow: PipeFlow = {
      kind: "sequence",
      steps: [
        step("주문접수", {
          consumes: { rawOrder: f("rawOrder") },
          produces: { validatedOrder: f("validatedOrder") },
          lineageHints: {
            validatedOrder: { sources: ["rawOrder"], transform: "compute" },
          },
        }),
        step("결제처리", {
          consumes: { validatedOrder: f("validatedOrder") },
          produces: { paymentResult: f("paymentResult") },
          lineageHints: {
            paymentResult: { sources: ["validatedOrder"], transform: "compute" },
          },
        }),
      ],
    };

    const lineages = deriveStaticLineage(flow);

    // step 내부 계보 2건 + step 간 체인 1건 = 3건
    expect(lineages).toHaveLength(3);

    // step 내부: rawOrder → validatedOrder
    const step1 = lineages.find(l => l.target.column === "validatedOrder" && l.stepPath === "flow.steps[0]");
    expect(step1).toBeDefined();
    expect(step1!.sources[0].column).toBe("rawOrder");

    // step 간 체인: 주문접수.validatedOrder → 결제처리.validatedOrder
    const chain = lineages.find(l => l.stepPath.includes("chain"));
    expect(chain).toBeDefined();
    expect(chain!.sources[0].schemaId).toBe("주문접수"); // 이전 step의 schemaId
    expect(chain!.target.schemaId).toBe("결제처리");     // 다음 step의 schemaId
    expect(chain!.target.column).toBe("validatedOrder");
  });
});

// ── 핵심 증명 4: flow 레벨 요약 (folding 기반) ──────

describe("flow 계보 요약 — summarizeFlowLineage", () => {
  it("3단계 sequence: rawOrder → validatedOrder → paymentResult — 최종 계보 압축", () => {
    const flow: PipeFlow = {
      kind: "sequence",
      steps: [
        step("검증", {
          consumes: { rawOrder: f("rawOrder") },
          produces: { validatedOrder: f("validatedOrder") },
          lineageHints: {
            validatedOrder: { sources: ["rawOrder"], transform: "compute" },
          },
        }),
        step("결제", {
          consumes: { validatedOrder: f("validatedOrder") },
          produces: { paymentResult: f("paymentResult") },
          lineageHints: {
            paymentResult: { sources: ["validatedOrder"], transform: "compute" },
          },
        }),
      ],
    };

    const summary = summarizeFlowLineage(flow);

    // flow 전체 입력: rawOrder (외부에서 들어옴)
    expect(summary.inputs).toEqual(["rawOrder"]);

    // flow 전체 출력: paymentResult (마지막 step produces)
    expect(summary.outputs).toEqual(["paymentResult"]);

    // 압축 계보: paymentResult ← rawOrder (중간 validatedOrder 생략)
    expect(summary.outputLineage.paymentResult).toEqual(["rawOrder"]);
  });

  it("a + b → c, c → d — 최종 d의 계보 [a, b]", () => {
    const flow: PipeFlow = {
      kind: "sequence",
      steps: [
        step("합산", {
          consumes: { a: n("a"), b: n("b") },
          produces: { c: n("c") },
          lineageHints: { c: { sources: ["a", "b"], transform: "compute" } },
        }),
        step("변환", {
          consumes: { c: n("c") },
          produces: { d: n("d") },
          lineageHints: { d: { sources: ["c"], transform: "compute" } },
        }),
      ],
    };

    const summary = summarizeFlowLineage(flow);

    expect(summary.inputs.toSorted()).toEqual(["a", "b"]);
    expect(summary.outputs).toEqual(["d"]);
    // d ← c ← [a, b] → 압축: d ← [a, b]
    expect(summary.outputLineage.d?.toSorted()).toEqual(["a", "b"]);
  });

  it("a 통과 + b 소비 → c, c → d — 최종 d의 계보 [a] (b 제외)", () => {
    const flow: PipeFlow = {
      kind: "sequence",
      steps: [
        step("필터", {
          consumes: { a: f("a"), b: f("b") },
          produces: { c: f("c") },
          lineageHints: { c: { sources: ["a"], transform: "direct" } },
        }),
        step("가공", {
          consumes: { c: f("c") },
          produces: { d: f("d") },
          lineageHints: { d: { sources: ["c"], transform: "compute" } },
        }),
      ],
    };

    const summary = summarizeFlowLineage(flow);

    expect(summary.inputs.toSorted()).toEqual(["a", "b"]);
    expect(summary.outputs).toEqual(["d"]);
    // d ← c ← [a] → 압축: d ← [a] (b는 소비되어 사라짐)
    expect(summary.outputLineage.d).toEqual(["a"]);
  });
});

// ── 레퍼런스 5: branch — 경로별 계보 합집합 ─────────

describe("정적 계보 — branch", () => {
  it("branch: 각 경로의 입력 계보 합집합", () => {
    const flow: PipeFlow = {
      kind: "branch",
      condition: "type",
      paths: [
        step("카드결제", {
          consumes: { orderId: f("orderId"), cardNo: f("cardNo") },
          produces: { receipt: f("receipt") },
          lineageHints: { receipt: { sources: ["orderId", "cardNo"], transform: "compute" } },
        }),
        step("계좌이체", {
          consumes: { orderId: f("orderId"), bankAccount: f("bankAccount") },
          produces: { receipt: f("receipt") },
          lineageHints: { receipt: { sources: ["orderId", "bankAccount"], transform: "compute" } },
        }),
      ],
    };

    const summary = summarizeFlowLineage(flow);
    // 두 경로 합집합: orderId, cardNo, bankAccount
    expect(summary.inputs.toSorted()).toEqual(["bankAccount", "cardNo", "orderId"]);
    expect(summary.outputs).toEqual(["receipt"]);
  });
});

// ── 레퍼런스 6: parallel — 병렬 계보 ────────────────

describe("정적 계보 — parallel", () => {
  it("parallel: 독립 병렬 step의 계보 각각 추출", () => {
    const flow: PipeFlow = {
      kind: "parallel",
      steps: [
        step("알림발송", {
          consumes: { userId: f("userId") },
          produces: { notified: f("notified") },
          lineageHints: { notified: { sources: ["userId"], transform: "compute" } },
        }),
        step("로그기록", {
          consumes: { eventData: f("eventData") },
          produces: { logged: f("logged") },
          lineageHints: { logged: { sources: ["eventData"], transform: "direct" } },
        }),
      ],
    };

    const lineages = deriveStaticLineage(flow);
    expect(lineages).toHaveLength(2);

    const notif = lineages.find(l => l.target.column === "notified");
    expect(notif!.sources[0].column).toBe("userId");

    const log = lineages.find(l => l.target.column === "logged");
    expect(log!.sources[0].column).toBe("eventData");
  });
});

// ── 레퍼런스 7: transition-scope 내 계보 ────────────

describe("정적 계보 — transition-scope", () => {
  it("transition-scope body의 sequence 체인 계보 추적", () => {
    const flow: PipeFlow = {
      kind: "transition-scope",
      transitionId: "transfer.execute",
      events: ["account.debit", "account.credit"],
      body: {
        kind: "sequence",
        steps: [
          step("출금", {
            consumes: { amount: n("amount"), fromAccount: f("fromAccount") },
            produces: { debitResult: f("debitResult") },
            lineageHints: { debitResult: { sources: ["amount", "fromAccount"], transform: "compute" } },
          }),
          step("입금", {
            consumes: { debitResult: f("debitResult"), toAccount: f("toAccount") },
            produces: { creditResult: f("creditResult") },
            lineageHints: { creditResult: { sources: ["debitResult", "toAccount"], transform: "compute" } },
          }),
        ],
      },
    };

    const summary = summarizeFlowLineage(flow);
    expect(summary.inputs.toSorted()).toEqual(["amount", "fromAccount", "toAccount"]);
    expect(summary.outputs).toEqual(["creditResult"]);
    // creditResult ← debitResult ← [amount, fromAccount] + toAccount
    expect(summary.outputLineage.creditResult?.toSorted()).toEqual(["amount", "fromAccount", "toAccount"]);
  });
});

// ── 레퍼런스 8: 4단계 깊은 체인 ─────────────────────

describe("정적 계보 — 깊은 체인", () => {
  it("4단계: raw → validated → enriched → final — 최초 입력까지 역추적", () => {
    const flow: PipeFlow = {
      kind: "sequence",
      steps: [
        step("수집", {
          consumes: { raw: f("raw") },
          produces: { validated: f("validated") },
          lineageHints: { validated: { sources: ["raw"], transform: "compute" } },
        }),
        step("보강", {
          consumes: { validated: f("validated"), externalData: f("externalData") },
          produces: { enriched: f("enriched") },
          lineageHints: { enriched: { sources: ["validated", "externalData"], transform: "compute" } },
        }),
        step("변환", {
          consumes: { enriched: f("enriched") },
          produces: { transformed: f("transformed") },
          lineageHints: { transformed: { sources: ["enriched"], transform: "compute" } },
        }),
        step("최종", {
          consumes: { transformed: f("transformed") },
          produces: { final: f("final") },
          lineageHints: { final: { sources: ["transformed"], transform: "direct" } },
        }),
      ],
    };

    const summary = summarizeFlowLineage(flow);
    expect(summary.inputs.toSorted()).toEqual(["externalData", "raw"]);
    expect(summary.outputs).toEqual(["final"]);
    // final ← transformed ← enriched ← [validated, externalData] ← [raw, externalData]
    expect(summary.outputLineage.final?.toSorted()).toEqual(["externalData", "raw"]);
  });
});

// ── 레퍼런스 9: 다중 출력 ───────────────────────────

describe("정적 계보 — 다중 출력", () => {
  it("하나의 입력에서 두 개 출력 분기", () => {
    const flow: PipeFlow = step("분기", {
      consumes: { order: f("order") },
      produces: { invoice: f("invoice"), shipment: f("shipment") },
      lineageHints: {
        invoice: { sources: ["order"], transform: "derive" },
        shipment: { sources: ["order"], transform: "derive" },
      },
    });

    const summary = summarizeFlowLineage(flow);
    expect(summary.inputs).toEqual(["order"]);
    expect(summary.outputs.toSorted()).toEqual(["invoice", "shipment"]);
    expect(summary.outputLineage.invoice).toEqual(["order"]);
    expect(summary.outputLineage.shipment).toEqual(["order"]);
  });
});

// ── 레퍼런스 10: 컬럼명 충돌 — schemaId 복합키 증명 ──

describe("정적 계보 — 컬럼명 충돌", () => {
  it("두 step이 같은 이름 'result' 생산 — 서로 간섭하지 않음", () => {
    const flow: PipeFlow = {
      kind: "sequence",
      steps: [
        step("stepA", {
          consumes: { inputA: f("inputA") },
          produces: { result: f("result") },
          lineageHints: { result: { sources: ["inputA"], transform: "compute" } },
        }),
        step("stepB", {
          consumes: { result: f("result"), inputB: f("inputB") },
          produces: { result: f("result") },
          lineageHints: { result: { sources: ["result", "inputB"], transform: "compute" } },
        }),
      ],
    };

    const summary = summarizeFlowLineage(flow);
    // stepB의 result ← [stepA의 result, inputB] ← [inputA, inputB]
    expect(summary.inputs.toSorted()).toEqual(["inputA", "inputB"]);
    expect(summary.outputs).toEqual(["result"]);
    expect(summary.outputLineage.result?.toSorted()).toEqual(["inputA", "inputB"]);
  });
});

// ── 레퍼런스 11: chain traversal 증명 ───────────────

describe("정적 계보 — chain 경계 횡단 증명", () => {
  it("필드명이 매 step마다 변하는 3단계 — chain record로만 횡단 가능", () => {
    // step1: x → a, step2: a → b, step3: b → y
    // step-internal로는 같은 schemaId 내 매핑, chain으로 step 간 연결
    const flow: PipeFlow = {
      kind: "sequence",
      steps: [
        step("gen", {
          consumes: { x: f("x") },
          produces: { a: f("a") },
          lineageHints: { a: { sources: ["x"], transform: "compute" } },
        }),
        step("transform", {
          consumes: { a: f("a") },
          produces: { b: f("b") },
          lineageHints: { b: { sources: ["a"], transform: "compute" } },
        }),
        step("finalize", {
          consumes: { b: f("b") },
          produces: { y: f("y") },
          lineageHints: { y: { sources: ["b"], transform: "compute" } },
        }),
      ],
    };

    const summary = summarizeFlowLineage(flow);
    expect(summary.inputs).toEqual(["x"]);
    expect(summary.outputs).toEqual(["y"]);
    // y ← b(finalize) ← b(transform via chain) ← a(transform) ← a(gen via chain) ← x(gen)
    expect(summary.outputLineage.y).toEqual(["x"]);
  });
});

// ── 레퍼런스 12: 3-step 실전 시나리오 ───────────────

describe("정적 계보 — 주문처리 실전 시나리오", () => {
  it("주문접수(rawOrder+customerId) → 결제(validatedOrder) → 배송(paymentResult+shippingAddress) — customerId 소비 증명", () => {
    const flow: PipeFlow = {
      kind: "sequence",
      steps: [
        step("주문접수", {
          consumes: { rawOrder: f("rawOrder"), customerId: f("customerId") },
          produces: { validatedOrder: f("validatedOrder") },
          // customerId는 인증 확인에만 사용 → sources에 미포함
          lineageHints: { validatedOrder: { sources: ["rawOrder"], transform: "compute" } },
        }),
        step("결제", {
          consumes: { validatedOrder: f("validatedOrder") },
          produces: { paymentResult: f("paymentResult") },
          lineageHints: { paymentResult: { sources: ["validatedOrder"], transform: "compute" } },
        }),
        step("배송", {
          consumes: { paymentResult: f("paymentResult"), shippingAddress: f("shippingAddress") },
          produces: { trackingId: f("trackingId") },
          lineageHints: { trackingId: { sources: ["paymentResult", "shippingAddress"], transform: "compute" } },
        }),
      ],
    };

    const summary = summarizeFlowLineage(flow);
    expect(summary.inputs.toSorted()).toEqual(["customerId", "rawOrder", "shippingAddress"]);
    expect(summary.outputs).toEqual(["trackingId"]);
    // trackingId ← [paymentResult, shippingAddress] ← [validatedOrder, shippingAddress] ← [rawOrder, shippingAddress]
    // customerId는 소비됨 — validatedOrder의 sources에 없으므로 계보에서 제외
    expect(summary.outputLineage.trackingId?.toSorted()).toEqual(["rawOrder", "shippingAddress"]);
  });
});

// ── data-object 통합 — validateStaticLineage ────────

describe("validateStaticLineage — data-object 바인딩 연동", () => {
  it("binding 있는 step → chain.bound 카운트", () => {
    const pipe: PipeSpec = {
      pipeId: "order-pipe", version: "v1",
      trigger: { eventKey: "start" },
      flow: {
        kind: "sequence",
        steps: [
          step("주문접수", {
            consumes: { rawOrder: f("rawOrder") },
            produces: { validatedOrder: f("validatedOrder") },
            lineageHints: { validatedOrder: { sources: ["rawOrder"], transform: "compute" } },
          }),
        ],
      },
    };

    const registry = new BindingRegistry();
    // schemaId는 resolveStepSchemaId(step, pipeId) → eventKey ?? facet ?? pipeId → "주문접수"
    registry.register({
      schemaId: "주문접수",
      schemaVersion: "v1",
      prefixId: "order_event",
      prefixVersion: "v1",
      columnToAxis: { validatedOrder: { dimLabel: "order" } },
    });

    const result = validateStaticLineage(pipe, registry);
    expect(result.lineages).toHaveLength(1);
    expect(result.summary.inputs).toEqual(["rawOrder"]);
    expect(result.summary.outputs).toEqual(["validatedOrder"]);
    // target binding 있지만 source column(rawOrder)이 columnToAxis에 없으므로 mismatched
    expect(result.chain.mismatched).toBe(1);
  });

  it("binding 없는 step → chain.unbound", () => {
    const pipe: PipeSpec = {
      pipeId: "simple", version: "v1",
      trigger: { eventKey: "start" },
      flow: step("처리", {
        consumes: { input: f("input") },
        produces: { output: f("output") },
        lineageHints: { output: { sources: ["input"], transform: "direct" } },
      }),
    };

    const registry = new BindingRegistry();
    // 아무 binding 없음

    const result = validateStaticLineage(pipe, registry);
    expect(result.lineages).toHaveLength(1);
    expect(result.chain.unbound).toBe(1);
    expect(result.chain.bound).toBe(0);
  });
});

// ── 안정화: 비-step 래퍼 체인 ───────────────────────

describe("정적 계보 — 비-step 래퍼 chain 횡단", () => {
  it("sequence: [step_A, branch{step_B, step_C}, step_D] — A→branch, branch→D 체인 연결", () => {
    const flow: PipeFlow = {
      kind: "sequence",
      steps: [
        step("A", {
          produces: { data: f("data") },
          lineageHints: { data: { sources: [], transform: "compute" } },
        }),
        {
          kind: "branch",
          condition: "type",
          paths: [
            step("B", {
              consumes: { data: f("data") },
              produces: { result: f("result") },
              lineageHints: { result: { sources: ["data"], transform: "compute" } },
            }),
            step("C", {
              consumes: { data: f("data") },
              produces: { result: f("result") },
              lineageHints: { result: { sources: ["data"], transform: "compute" } },
            }),
          ],
        },
        step("D", {
          consumes: { result: f("result") },
          produces: { final: f("final") },
          lineageHints: { final: { sources: ["result"], transform: "direct" } },
        }),
      ],
    };

    const summary = summarizeFlowLineage(flow);
    expect(summary.outputs).toEqual(["final"]);
    // final ← result ← data ← (생성) — data가 외부 입력이 아니면 계보 비어있음
    // data는 produces에서 생성되므로 외부 입력 아님, 결과적으로 계보 없음이 정확
  });

  it("sequence: [step_A(produces x), parallel{step_B, step_C}, step_D(consumes x)] — 래퍼 건너뛴 체인", () => {
    const flow: PipeFlow = {
      kind: "sequence",
      steps: [
        step("A", {
          consumes: { input: f("input") },
          produces: { x: f("x") },
          lineageHints: { x: { sources: ["input"], transform: "compute" } },
        }),
        {
          kind: "parallel",
          steps: [
            step("side1", { consumes: { x: f("x") } }),
            step("side2", { consumes: { x: f("x") } }),
          ],
        },
        step("D", {
          consumes: { x: f("x") },
          produces: { output: f("output") },
          lineageHints: { output: { sources: ["x"], transform: "direct" } },
        }),
      ],
    };

    const lineages = deriveStaticLineage(flow);
    // A→parallel chain: A.x → parallel.x (parallel의 첫 consumes)
    const chainAtoP = lineages.filter(l => l.stepPath.includes("chain[0→1]"));
    expect(chainAtoP.length).toBeGreaterThan(0);

    // parallel→D chain: parallel에 produces 없음(side effect only) → A.x가 D까지 직접 체인 안 됨
    // 이건 정상 — parallel이 데이터를 pass-through하지 않으면 D는 별도 입력 필요
    const chainPtoD = lineages.filter(l => l.stepPath.includes("chain[1→2]"));
    expect(chainPtoD.length).toBe(0); // produces 없는 래퍼 → 체인 끊김 (정상)
  });
});

// ── 안정화: 엣지 케이스 ─────────────────────────────

describe("정적 계보 — 엣지 케이스", () => {
  it("dataContract 없는 step → 계보 없음", () => {
    const flow: PipeFlow = { kind: "step", facet: "빈_step" };
    expect(deriveStaticLineage(flow)).toEqual([]);
    const summary = summarizeFlowLineage(flow);
    expect(summary.inputs).toEqual([]);
    expect(summary.outputs).toEqual([]);
  });

  it("빈 sequence → 계보 없음", () => {
    const flow: PipeFlow = { kind: "sequence", steps: [] };
    expect(deriveStaticLineage(flow)).toEqual([]);
  });

  it("단일 step sequence → 체인 없음, step 내부 계보만", () => {
    const flow: PipeFlow = {
      kind: "sequence",
      steps: [
        step("only", {
          consumes: { a: f("a") },
          produces: { b: f("b") },
          lineageHints: { b: { sources: ["a"], transform: "direct" } },
        }),
      ],
    };
    const lineages = deriveStaticLineage(flow);
    expect(lineages).toHaveLength(1); // step 내부만, chain 없음
    expect(lineages[0].target.column).toBe("b");
  });

  it("optional 내부 step 계보 추출", () => {
    const flow: PipeFlow = {
      kind: "optional",
      step: step("선택적", {
        consumes: { input: f("input") },
        produces: { output: f("output") },
        lineageHints: { output: { sources: ["input"], transform: "direct" } },
      }),
    };
    const lineages = deriveStaticLineage(flow);
    expect(lineages).toHaveLength(1);
    expect(lineages[0].sources[0].column).toBe("input");
  });

  it("retry 내부 step 계보 추출", () => {
    const flow: PipeFlow = {
      kind: "retry",
      maxAttempts: 3,
      step: step("재시도", {
        consumes: { request: f("request") },
        produces: { response: f("response") },
        lineageHints: { response: { sources: ["request"], transform: "compute" } },
      }),
    };
    const lineages = deriveStaticLineage(flow);
    expect(lineages).toHaveLength(1);
  });

  it("fallback — try + catch 양쪽 계보", () => {
    const flow: PipeFlow = {
      kind: "fallback",
      try: step("주경로", {
        consumes: { input: f("input") },
        produces: { result: f("result") },
        lineageHints: { result: { sources: ["input"], transform: "compute" } },
      }),
      catch: step("대체경로", {
        consumes: { input: f("input") },
        produces: { result: f("result") },
        lineageHints: { result: { sources: ["input"], transform: "direct" } },
      }),
    };
    const lineages = deriveStaticLineage(flow);
    expect(lineages).toHaveLength(2); // try 1건 + catch 1건
  });

  it("reduce — accumulator 집계 계보", () => {
    const flow: PipeFlow = {
      kind: "reduce",
      initial: "0",
      accumulator: "total",
      step: step("누적", {
        consumes: { amount: n("amount"), total: n("total") },
        produces: { total: n("total") },
        lineageHints: { total: { sources: ["amount", "total"], transform: "aggregate" } },
      }),
    };
    const lineages = deriveStaticLineage(flow);
    // step 내부 (hints): total ← [amount, total]
    const internal = lineages.find(l => l.stepPath.includes(".step"));
    expect(internal).toBeDefined();
    expect(internal!.transform).toBe("aggregate");
    // accumulate 패턴: consume total → produce total
    const accum = lineages.find(l => l.stepPath.includes(".accumulate"));
    expect(accum).toBeDefined();
    expect(accum!.transform).toBe("aggregate");
  });

  it("reduce — lineageHints 없을 때 accumulate 패턴만", () => {
    const flow: PipeFlow = {
      kind: "reduce",
      initial: "0",
      accumulator: "sum",
      step: step("합산", {
        consumes: { value: n("value"), sum: n("sum") },
        produces: { sum: n("sum") },
      }),
    };
    const lineages = deriveStaticLineage(flow);
    // hints 없으므로 step 내부 계보 없음, accumulate 패턴만
    const accum = lineages.find(l => l.stepPath.includes(".accumulate"));
    expect(accum).toBeDefined();
    expect(accum!.target.column).toBe("sum");
  });

  it("reduce — accumulator 패턴 없으면 경고 발행", () => {
    const flow: PipeFlow = {
      kind: "reduce",
      initial: "0",
      accumulator: "total",
      step: step("변환", {
        consumes: { input: n("input") },
        produces: { output: n("output") },
      }),
    };
    const { lineages, warnings } = deriveStaticLineageWithDiagnostics(flow);
    // consumes와 produces에 같은 필드 없음 → accumulator 패턴 미감지
    const accum = lineages.find(l => l.stepPath.includes(".accumulate"));
    expect(accum).toBeUndefined();
    // 경고 발행
    expect(warnings).toHaveLength(1);
    expect(warnings[0].path).toContain("reduce");
    expect(warnings[0].message).toContain("accumulator 패턴 없음");
  });

  it("reduce — accumulator 패턴 있으면 경고 없음", () => {
    const flow: PipeFlow = {
      kind: "reduce",
      initial: "0",
      accumulator: "sum",
      step: step("합산", {
        consumes: { value: n("value"), sum: n("sum") },
        produces: { sum: n("sum") },
      }),
    };
    const { warnings } = deriveStaticLineageWithDiagnostics(flow);
    expect(warnings).toHaveLength(0);
  });
});

// ── findFieldOrigin — 단일 필드 역추적 ──────────────

describe("findFieldOrigin", () => {
  it("단일 step — output의 origin = input", () => {
    const flow: PipeFlow = step("처리", {
      consumes: { input: f("input") },
      produces: { output: f("output") },
      lineageHints: { output: { sources: ["input"], transform: "compute" } },
    });
    expect(findFieldOrigin(flow, "output")).toEqual(["input"]);
  });

  it("3단계 chain — 최종 출력의 origin = 최초 입력", () => {
    const flow: PipeFlow = {
      kind: "sequence",
      steps: [
        step("수집", {
          consumes: { raw: f("raw") },
          produces: { validated: f("validated") },
          lineageHints: { validated: { sources: ["raw"], transform: "compute" } },
        }),
        step("가공", {
          consumes: { validated: f("validated") },
          produces: { enriched: f("enriched") },
          lineageHints: { enriched: { sources: ["validated"], transform: "compute" } },
        }),
        step("출력", {
          consumes: { enriched: f("enriched") },
          produces: { final: f("final") },
          lineageHints: { final: { sources: ["enriched"], transform: "direct" } },
        }),
      ],
    };
    expect(findFieldOrigin(flow, "final")).toEqual(["raw"]);
  });

  it("소비 구분 — customerId 소비, rawOrder만 기여", () => {
    const flow: PipeFlow = {
      kind: "sequence",
      steps: [
        step("접수", {
          consumes: { rawOrder: f("rawOrder"), customerId: f("customerId") },
          produces: { validated: f("validated") },
          lineageHints: { validated: { sources: ["rawOrder"], transform: "compute" } },
        }),
        step("처리", {
          consumes: { validated: f("validated") },
          produces: { result: f("result") },
          lineageHints: { result: { sources: ["validated"], transform: "direct" } },
        }),
      ],
    };
    expect(findFieldOrigin(flow, "result")).toEqual(["rawOrder"]);
  });

  it("존재하지 않는 필드 → 빈 배열", () => {
    const flow: PipeFlow = step("처리", { produces: { output: f("output") } });
    expect(findFieldOrigin(flow, "nonexistent")).toEqual([]);
  });
});

// ── deriveGraphLineage — graph-level 계보 ───────────

describe("deriveGraphLineage", () => {
  function makePipe(id: string, flow: PipeFlow): PipeSpec {
    return { pipeId: id, version: "v1", trigger: { eventKey: `${id}.start` }, flow };
  }

  it("2-pipe graph — cross-pipe chain 생성", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "v1",
      pipes: [
        makePipe("producer", step("생산", {
          consumes: { raw: f("raw") },
          produces: { data: f("data") },
          lineageHints: { data: { sources: ["raw"], transform: "compute" } },
        })),
        makePipe("consumer", step("소비", {
          consumes: { data: f("data") },
          produces: { result: f("result") },
          lineageHints: { result: { sources: ["data"], transform: "direct" } },
        })),
      ],
      connections: [{ from: "producer", to: "consumer", kind: "next" }],
      entryPipeId: "producer",
    };

    const summary = deriveGraphLineage(graph);

    // pipe별 내부 계보
    expect(summary.pipeLineages.get("producer")).toHaveLength(1);
    expect(summary.pipeLineages.get("consumer")).toHaveLength(1);

    // cross-pipe chain: producer.data → consumer.data
    expect(summary.crossPipeChains).toHaveLength(1);
    expect(summary.crossPipeChains[0].target.column).toBe("data");
    expect(summary.crossPipeChains[0].pipeId).toBe("producer→consumer");

    // 전체 통합
    expect(summary.allLineages).toHaveLength(3); // producer 1 + consumer 1 + chain 1
  });

  it("connection 없는 graph — cross-pipe chain 없음", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "v1",
      pipes: [
        makePipe("isolated", step("단독", {
          consumes: { a: f("a") },
          produces: { b: f("b") },
          lineageHints: { b: { sources: ["a"], transform: "direct" } },
        })),
      ],
      connections: [],
      entryPipeId: "isolated",
    };

    const summary = deriveGraphLineage(graph);
    expect(summary.crossPipeChains).toEqual([]);
    expect(summary.allLineages).toHaveLength(1);
  });

  it("3-pipe chain — 2개 cross-pipe chain", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "v1",
      pipes: [
        makePipe("A", step("수집", { produces: { x: f("x") }, lineageHints: { x: { sources: [], transform: "compute" } } })),
        makePipe("B", step("변환", { consumes: { x: f("x") }, produces: { y: f("y") }, lineageHints: { y: { sources: ["x"], transform: "compute" } } })),
        makePipe("C", step("출력", { consumes: { y: f("y") }, produces: { z: f("z") }, lineageHints: { z: { sources: ["y"], transform: "direct" } } })),
      ],
      connections: [
        { from: "A", to: "B", kind: "next" },
        { from: "B", to: "C", kind: "event" },
      ],
      entryPipeId: "A",
    };

    const summary = deriveGraphLineage(graph);
    expect(summary.crossPipeChains).toHaveLength(2); // A→B, B→C
  });

  it("facetType 필터링 — 해당 필드만 cross-pipe 연결", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "v1",
      pipes: [
        makePipe("producer", step("생산", {
          produces: { data: f("data"), meta: f("meta") },
          lineageHints: {
            data: { sources: [], transform: "compute" },
            meta: { sources: [], transform: "compute" },
          },
        })),
        makePipe("consumer", step("소비", {
          consumes: { data: f("data"), meta: f("meta") },
          produces: { result: f("result") },
          lineageHints: { result: { sources: ["data", "meta"], transform: "compute" } },
        })),
      ],
      connections: [{ from: "producer", to: "consumer", kind: "next", facetType: "data" }],
      entryPipeId: "producer",
    };

    const summary = deriveGraphLineage(graph);
    // facetType="data" → data만 연결, meta는 제외
    expect(summary.crossPipeChains).toHaveLength(1);
    expect(summary.crossPipeChains[0].target.column).toBe("data");
  });

  it("PortRef 기반 port facetType — port 단위 정밀 연결", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "v1",
      pipes: [
        {
          ...makePipe("producer", step("생산", {
            produces: { data: f("data"), meta: f("meta") },
            lineageHints: {
              data: { sources: [], transform: "compute" },
              meta: { sources: [], transform: "compute" },
            },
          })),
          ports: [
            { portId: "data_out", direction: "out", facetType: "data" },
            { portId: "meta_out", direction: "out", facetType: "meta" },
          ],
        },
        makePipe("consumer", step("소비", {
          consumes: { data: f("data"), meta: f("meta") },
          produces: { result: f("result") },
          lineageHints: { result: { sources: ["data", "meta"], transform: "compute" } },
        })),
      ],
      connections: [{
        from: { pipeId: "producer", portId: "data_out" },
        to: "consumer",
        kind: "next",
        // connection-level facetType 없음 — PortRef의 port facetType 사용
      }],
      entryPipeId: "producer",
    };

    const summary = deriveGraphLineage(graph);
    // producer의 data_out port facetType="data" → data 필드만 연결
    expect(summary.crossPipeChains).toHaveLength(1);
    expect(summary.crossPipeChains[0].target.column).toBe("data");
  });

  it("findFieldOriginInGraph — cross-pipe 역추적", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "v1",
      pipes: [
        makePipe("source", step("원본", {
          consumes: { raw: f("raw") },
          produces: { data: f("data") },
          lineageHints: { data: { sources: ["raw"], transform: "compute" } },
        })),
        makePipe("sink", step("출력", {
          consumes: { data: f("data") },
          produces: { result: f("result") },
          lineageHints: { result: { sources: ["data"], transform: "direct" } },
        })),
      ],
      connections: [{ from: "source", to: "sink", kind: "next" }],
      entryPipeId: "source",
    };

    const origins = findFieldOriginInGraph(graph, "sink", "result");
    expect(origins).toEqual(["raw"]);
  });

  it("summarizeGraphLineage — graph 전체 입출력 압축", () => {
    const graph: PipeGraph = {
      graphId: "g1", version: "v1",
      pipes: [
        makePipe("A", step("수집", {
          consumes: { input: f("input") },
          produces: { x: f("x") },
          lineageHints: { x: { sources: ["input"], transform: "compute" } },
        })),
        makePipe("B", step("출력", {
          consumes: { x: f("x") },
          produces: { output: f("output") },
          lineageHints: { output: { sources: ["x"], transform: "direct" } },
        })),
      ],
      connections: [{ from: "A", to: "B", kind: "next" }],
      entryPipeId: "A",
    };

    const summary = summarizeGraphLineage(graph);
    expect(summary.inputs).toEqual(["input"]);
    expect(summary.outputs).toEqual(["output"]);
    expect(summary.outputLineage.output).toEqual(["input"]);
  });
});

// ── 계보 직렬화 + diff ──────────────────────────────

describe("계보 직렬화", () => {
  const sampleLineage = deriveStaticLineage(
    step("처리", {
      consumes: { a: f("a") },
      produces: { b: f("b") },
      lineageHints: { b: { sources: ["a"], transform: "compute" } },
    }),
  );

  it("lineageId — 안정 키 생성", () => {
    const id = lineageId(sampleLineage[0]);
    expect(id).toContain("b");
    expect(id).toContain("a");
    expect(id).toContain("compute");
  });

  it("serialize → deserialize 라운드트립", () => {
    const json = serializeLineage(sampleLineage);
    const restored = deserializeLineage(json);
    expect(restored).toEqual(sampleLineage);
  });

  it("diffLineage — 추가/제거 감지", () => {
    const prev = deriveStaticLineage(step("v1", {
      consumes: { a: f("a") },
      produces: { b: f("b") },
      lineageHints: { b: { sources: ["a"], transform: "direct" } },
    }));
    const next = deriveStaticLineage(step("v2", {
      consumes: { a: f("a"), c: f("c") },
      produces: { b: f("b") },
      lineageHints: { b: { sources: ["a", "c"], transform: "compute" } },
    }));

    const diff = diffLineage(prev, next);
    expect(diff.added).toHaveLength(1);  // v2의 새 lineage
    expect(diff.removed).toHaveLength(1); // v1의 lineage
    expect(diff.unchanged).toBe(0);
  });

  it("diffLineage — 동일하면 unchanged만", () => {
    const diff = diffLineage(sampleLineage, sampleLineage);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.unchanged).toBe(1);
  });
});
