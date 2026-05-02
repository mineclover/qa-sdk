// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * Extraction Pipeline 테스트 — 패싯별 분리.
 *
 * 패싯:
 *   1. 파서 (regex mock) — 구조적 사실 추출
 *   2. LLM (mock) — testability + branch-significance 판단
 *   3. 파이프라인 (통합) �� 4단계 end-to-end
 *   4. 프롬프트 — 템플릿 구성 + mock 판단 규칙
 */

import { describe, it, expect } from "vitest";
import { createRegexParser } from "./extraction-parser.js";
import { runExtractionPipeline } from "./extraction-pipeline.js";
import { createMockLlm, buildPrompt } from "./extraction-prompts.js";
import type { LlmJudgmentRequest } from "./extraction.js";

const parser = createRegexParser();
const mockLlm = createMockLlm();

// ── 패싯 1: 파서 ──────────────────────────────────────

describe("createRegexParser", () => {
  it("함수 추출 — 이름, 파라미터, 반환 타입", () => {
    const result = parser.parseFile("test.ts", `
export function processOrder(order: Order, mode: string): PaymentResult {
  if (order.type === "express") {
    return handleExpress(order);
  }
  return handleNormal(order);
}
`);
    expect(result.functions).toHaveLength(1);
    expect(result.functions[0].id).toBe("processOrder");
    expect(result.functions[0].params).toHaveLength(2);
    expect(result.functions[0].returnType).toBe("PaymentResult");
  });

  it("조건문 추출 — if/switch", () => {
    const result = parser.parseFile("test.ts", `
function route(type: OrderType): void {
  switch (type) {
    case "normal": handleNormal(); break;
    case "express": handleExpress(); break;
    case "subscription": handleSub(); break;
  }
  if (type === "express") {
    notifyPriority();
  }
}
`);
    const switches = result.conditionals.filter(c => c.kind === "switch");
    const ifs = result.conditionals.filter(c => c.kind === "if");
    expect(switches).toHaveLength(1);
    expect(switches[0].branchCount).toBe(3);
    expect(ifs.length).toBeGreaterThanOrEqual(1);
  });

  it("enum/union 추출", () => {
    const result = parser.parseFile("test.ts", `
enum PaymentMethod { Card, Bank, Crypto, Point }
type OrderType = "normal" | "express" | "subscription";
`);
    expect(result.types).toHaveLength(2);
    expect(result.types[0].memberCount).toBe(4);
    expect(result.types[1].memberCount).toBe(3);
  });

  it("import 추출", () => {
    const result = parser.parseFile("test.ts", `
import { Order } from "./order.js";
import type { Payment } from "../payment.js";
`);
    expect(result.imports).toContain("./order.js");
    expect(result.imports).toContain("../payment.js");
  });

  it("주석 마커 추출", () => {
    const result = parser.parseFile("test.ts", `
/**
 * ^intent 결제 처리 핵심 로직
 * ^contract 주문 상태 PENDING
 * ^branches orderType(3), paymentMethod(4)
 */
export function processPayment(input: PaymentInput): PaymentResult {
  return { ok: true };
}
`);
    expect(result.functions[0].leadingComment).toContain("^intent");
    expect(result.functions[0].leadingComment).toContain("^branches");
  });
});

// ── 패싯 2: Mock LLM ─────────────────────────────────

describe("createMockLlm", () => {
  it("testability — 파라미터+반환 타입 있으면 testable", async () => {
    const res = await mockLlm.judge({
      kind: "testability",
      codeSnippet: "function process(x: string): number { return 1; }",
      context: { paramCount: 1, hasReturn: true, markers: [] },
    });
    expect(res.verdict).toBe(true);
    expect(res.confidence).toBeGreaterThan(0.5);
  });

  it("testability — 파라미터 없고 void면 not testable", async () => {
    const res = await mockLlm.judge({
      kind: "testability",
      codeSnippet: "function init(): void { console.log('ok'); }",
      context: { paramCount: 0, hasReturn: false, markers: [] },
    });
    expect(res.verdict).toBe(false);
  });

  it("testability — ^intent 마커 있으면 testable", async () => {
    const res = await mockLlm.judge({
      kind: "testability",
      codeSnippet: "function noop(): void {}",
      context: { paramCount: 0, hasReturn: false, markers: ["intent: 핵심 로직"] },
    });
    expect(res.verdict).toBe(true);
  });

  it("branch-significance — null 체크는 제외", async () => {
    const res = await mockLlm.judge({
      kind: "branch-significance",
      codeSnippet: "if (x == null) return;",
      context: { branchCount: 2 },
    });
    expect(res.verdict).toBe(false);
  });

  it("branch-significance — 비즈니스 분기는 포함", async () => {
    const res = await mockLlm.judge({
      kind: "branch-significance",
      codeSnippet: "switch (orderType) { case 'normal': ... case 'express': ... }",
      context: { branchCount: 3, branchLabels: ["normal", "express", "subscription"] },
    });
    expect(res.verdict).toBe(true);
  });

  it("side-effects — fetch 포함이면 http-request", async () => {
    const res = await mockLlm.judge({
      kind: "side-effects",
      codeSnippet: "await fetch(url)",
    });
    expect(res.extracted?.sideEffects).toContain("http-request");
  });
});

// ── 패싯 3: 파이프라인 (통합) ─────────────────────────

describe("runExtractionPipeline", () => {
  it("전체 흐름: 소스 → ExtractionResult", async () => {
    const files = [{
      filePath: "src/order/process.ts",
      source: `
import { Order } from "./order.js";

/**
 * ^intent 주문 처��� 핵심 로직
 * ^branches orderType(3), paymentMethod(4)
 */
export function processOrder(order: Order, mode: string): PaymentResult {
  switch (order.type) {
    case "normal": return handleNormal(order);
    case "express": return handleExpress(order);
    case "subscription": return handleSub(order);
  }
  if (mode === "fast") {
    return quickProcess(order);
  }
  return defaultProcess(order);
}

function helperOnly(): void {
  console.log("internal");
}
`,
    }];

    const result = await runExtractionPipeline(files, parser, mockLlm);

    expect(result.stats.filesScanned).toBe(1);
    expect(result.stats.functionsFound).toBeGreaterThanOrEqual(1);
    expect(result.stats.unitsIdentified).toBeGreaterThanOrEqual(1);

    // processOrder는 testable (params + return type)
    const processUnit = result.units.find(u => u.functionId === "processOrder");
    expect(processUnit).toBeDefined();
    expect(processUnit!.meta.testable).toBe(true);
    expect(processUnit!.meta.markers.some(m => m.marker === "intent")).toBe(true);

    // 분기가 있으면 totalPaths > 1
    if (processUnit!.branchGraph.length > 0) {
      expect(processUnit!.totalPaths).toBeGreaterThan(1);
    }

    // helperOnly는 void+no params → 제외
    const helperUnit = result.units.find(u => u.functionId === "helperOnly");
    expect(helperUnit).toBeUndefined();
  });

  it("빈 파일 → 0건", async () => {
    const result = await runExtractionPipeline(
      [{ filePath: "empty.ts", source: "// nothing" }],
      parser,
      mockLlm,
    );
    expect(result.units).toHaveLength(0);
    expect(result.totalPaths).toBe(0);
  });

  it("분기 없는 함수 → totalPaths = 1", async () => {
    const result = await runExtractionPipeline(
      [{ filePath: "simple.ts", source: `
export function add(a: number, b: number): number {
  return a + b;
}
` }],
      parser,
      mockLlm,
    );
    expect(result.units).toHaveLength(1);
    expect(result.units[0].totalPaths).toBe(1);
  });
});

// ── 패싯 4: 프롬프트 구성 ─────────────────────────────

describe("buildPrompt", () => {
  it("testability 프롬프트에 코드 포함", () => {
    const req: LlmJudgmentRequest = {
      kind: "testability",
      codeSnippet: "function foo(x: string): number { return 1; }",
      context: { markers: ["intent: 핵심 로직"] },
    };
    const prompt = buildPrompt(req);
    expect(prompt).toContain("독립적으로 테스트 가능한");
    expect(prompt).toContain("function foo");
    expect(prompt).toContain("핵심 로직");
  });

  it("branch-significance 프롬프트", () => {
    const req: LlmJudgmentRequest = {
      kind: "branch-significance",
      codeSnippet: "switch (type) { case 'a': ... }",
    };
    const prompt = buildPrompt(req);
    expect(prompt).toContain("비즈니스");
    expect(prompt).toContain("switch (type)");
  });
});
