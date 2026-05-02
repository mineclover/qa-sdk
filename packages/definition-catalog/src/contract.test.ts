// @def.doc definition-contract

/**
 * 계약 조립 검증 — assembleContract으로 계약 constellation을 조립할 수 있는가
 */

import { describe, it, expect } from "vitest";
import { assembleContract, parseEvidenceItems } from "./contract.js";
import { MemoryDefinitionRegistry } from "./registry.js";
import type { DefinitionEntry, DefinitionLink } from "./types.js";

// ─── 테스트 fixture: 주문 생성 계약 ────────────────────────

const now = new Date().toISOString();

function entry(
  id: string,
  scope: DefinitionEntry["scope"],
  aspect: DefinitionEntry["aspect"],
  depth: DefinitionEntry["depth"],
  title: string,
): DefinitionEntry {
  return {
    id, scope, aspect, depth, title,
    lifecycle: "approved",
    createdAt: now,
    updatedAt: now,
  };
}

const FIXTURES = {
  group: entry("order-create-contract", "feature", "func_def", "overview", "주문 생성 계약"),
  api: entry("order-create-api", "interface", "api_contract", "specification", "주문 생성 API"),
  precond: entry("order-create-precond", "constraint", "biz_constraint", "specification", "주문 사전 조건"),
  flow: entry("order-create-flow", "flow", "process_flow", "implementation", "주문 생성 흐름"),
  failures: entry("order-create-failures", "state", "system_state", "specification", "주문 실패 조건"),
  evidence: entry("order-create-evidence", "feature", "scenario", "validation", "주문 검증 증거"),
  postcond: entry("order-create-postcond", "constraint", "tech_constraint", "validation", "주문 사후 조건"),
};

const BODIES = new Map<string, string>([
  ["order-create-contract", `# 주문 생성 계약

## 목적 ^purpose

사용자가 주문을 생성하는 표준 시나리오를 정의한다.
결제 승인과 배송은 이 계약의 범위 밖이다.
`],

  ["order-create-api", `# 주문 생성 API

## 목적 ^purpose

주문 생성 요청/응답 스키마를 정의한다.

## 입력 ^inputs

- user_id: string (필수)
- items: Item[] (필수, 비어있지 않아야 함)
- payment_method: string (필수)
- request_timestamp: datetime

## 출력 ^outputs

- order_id: string (성공 시)
- status: "CREATED" | "REJECTED"
- rejected_reason?: string (실패 시 필수)
`],

  ["order-create-precond", `# 주문 사전 조건

## 목적 ^purpose

주문 생성 전 충족해야 할 조건.

## 사전 조건 ^precondition

1. user_id는 유효한 사용자여야 한다
2. items는 비어 있지 않아야 한다
3. payment_method는 지원 목록에 존재해야 한다
`],

  ["order-create-flow", `# 주문 생성 흐름

## 목적 ^purpose

주문 생성의 실행 순서를 정의한다.

## 실행 단계 ^flow-steps

1. 요청 payload를 정규화한다
2. 상품 목록 유효성을 확인한다
3. 결제 가능 여부를 확인한다
4. 주문 엔티티를 생성한다
5. 주문 저장 결과를 반환한다

## 분기 지점 ^decision-point

- 재고 부족 시 주문 생성 중단
- 결제 수단 미지원 시 주문 생성 중단
`],

  ["order-create-failures", `# 주문 실패 조건

## 목적 ^purpose

허용되지 않는 실패 상태를 정의한다.

## 실패 조건 ^failure

- invalid_user: 사용자 ID가 존재하지 않음
- unsupported_payment_method: 지원하지 않는 결제 수단
- empty_items: 주문 항목이 비어있음
- out_of_stock: 재고 부족
`],

  ["order-create-evidence", `# 주문 검증 증거

## 목적 ^purpose

검증에 필요한 증거 요구사항을 정의한다.

## 증거 요구 ^evidence

- 입력 정규화 로그 [reversible]
- 재고 검증 결과 [reversible]
- 결제 가능 여부 결과 [reversible]
- 저장 성공 여부 [irreversible]
`],

  ["order-create-postcond", `# 주문 사후 조건

## 목적 ^purpose

실행 후 보장해야 할 조건.

## 사후 조건 ^postcondition

1. order_id는 성공 시 반드시 존재
2. status는 CREATED 또는 REJECTED 중 하나
3. rejected_reason은 실패 시 반드시 존재
`],
]);

// ─── 레지스트리 구성 ────────────────────────────────────

function buildRegistry() {
  const reg = new MemoryDefinitionRegistry();

  for (const e of Object.values(FIXTURES)) {
    reg.register({ ...e, createdAt: now, updatedAt: now });
  }

  // 그룹 → 멤버 contains 링크
  for (const memberId of Object.keys(FIXTURES).filter(k => k !== "group")) {
    const fixture = FIXTURES[memberId as keyof typeof FIXTURES];
    reg.link("order-create-contract", fixture.id, "contains");
  }

  return reg;
}

// ─── 테스트 ─────────────────────────────────────────────

describe("assembleContract", () => {
  const reg = buildRegistry();

  const assembled = assembleContract(
    "order-create-contract",
    id => reg.get(id),
    (id, dir) => reg.getLinks(id, dir),
    id => BODIES.get(id),
  );

  it("null이 아닌 결과를 반환한다", () => {
    expect(assembled).not.toBeNull();
  });

  it("그룹 purpose가 추출된다", () => {
    expect(assembled!.group.purpose).toContain("주문을 생성하는 표준 시나리오");
  });

  it("inputs가 추출된다", () => {
    expect(assembled!.inputs.length).toBe(1);
    expect(assembled!.inputs[0].body).toContain("user_id");
    expect(assembled!.inputs[0].body).toContain("items");
    expect(assembled!.inputs[0].sourceScope).toBe("interface");
  });

  it("outputs가 추출된다", () => {
    expect(assembled!.outputs.length).toBe(1);
    expect(assembled!.outputs[0].body).toContain("order_id");
    expect(assembled!.outputs[0].body).toContain("CREATED");
  });

  it("preconditions가 추출된다", () => {
    expect(assembled!.preconditions.length).toBe(1);
    expect(assembled!.preconditions[0].body).toContain("유효한 사용자");
    expect(assembled!.preconditions[0].sourceScope).toBe("constraint");
  });

  it("postconditions가 추출된다", () => {
    expect(assembled!.postconditions.length).toBe(1);
    expect(assembled!.postconditions[0].body).toContain("order_id는 성공 시 반드시 존재");
  });

  it("steps가 추출된다", () => {
    expect(assembled!.steps.length).toBe(1);
    expect(assembled!.steps[0].body).toContain("요청 payload를 정규화한다");
    expect(assembled!.steps[0].body).toContain("주문 저장 결과를 반환한다");
  });

  it("decisionPoints가 추출된다", () => {
    expect(assembled!.decisionPoints.length).toBe(1);
    expect(assembled!.decisionPoints[0].body).toContain("재고 부족");
    expect(assembled!.decisionPoints[0].markerDef.modeHint).toBe("llm");
  });

  it("failures가 추출된다", () => {
    expect(assembled!.failures.length).toBe(1);
    expect(assembled!.failures[0].body).toContain("invalid_user");
  });

  it("evidence가 추출된다", () => {
    expect(assembled!.evidence.length).toBe(1);
    expect(assembled!.evidence[0].body).toContain("입력 정규화 로그");
  });

  it("memberIds가 6개다", () => {
    expect(assembled!.memberIds.length).toBe(6);
  });

  it("allSections가 모든 슬롯의 합이다", () => {
    const slotTotal =
      assembled!.inputs.length +
      assembled!.outputs.length +
      assembled!.preconditions.length +
      assembled!.postconditions.length +
      assembled!.steps.length +
      assembled!.decisionPoints.length +
      assembled!.failures.length +
      assembled!.evidence.length;
    expect(assembled!.allSections.length).toBe(slotTotal);
  });
});

describe("ContractStats", () => {
  const reg = buildRegistry();

  const assembled = assembleContract(
    "order-create-contract",
    id => reg.get(id),
    (id, dir) => reg.getLinks(id, dir),
    id => BODIES.get(id),
  )!;

  it("totalSections = allSections.length", () => {
    expect(assembled.stats.totalSections).toBe(assembled.allSections.length);
  });

  it("codeSections + llmSections = totalSections", () => {
    expect(assembled.stats.codeSections + assembled.stats.llmSections)
      .toBe(assembled.stats.totalSections);
  });

  it("semanticDensity = llm / total", () => {
    const expected = assembled.stats.llmSections / assembled.stats.totalSections;
    expect(assembled.stats.semanticDensity).toBeCloseTo(expected);
  });

  it("branchingFactor = decision-point 섹션 수", () => {
    expect(assembled.stats.branchingFactor).toBe(assembled.decisionPoints.length);
  });

  it("completeness = 사용된 마커 종류 / 8", () => {
    // 8종 마커 전부 사용: inputs, outputs, precondition, postcondition,
    // flow-steps, decision-point, failure, evidence
    expect(assembled.stats.completeness).toBe(1);
  });

  it("evidenceReversibilityRatio = reversible / 전체 증거", () => {
    // 4개 증거 중 3개 reversible, 1개 irreversible → 0.75
    expect(assembled.stats.evidenceReversibilityRatio).toBeCloseTo(0.75);
  });
});

describe("assembleContract — 빈 케이스", () => {
  it("존재하지 않는 그룹은 null", () => {
    const reg = new MemoryDefinitionRegistry();
    const result = assembleContract(
      "nonexistent",
      id => reg.get(id),
      (id, dir) => reg.getLinks(id, dir),
      () => undefined,
    );
    expect(result).toBeNull();
  });

  it("멤버가 없는 그룹은 빈 계약", () => {
    const reg = new MemoryDefinitionRegistry();
    reg.register({
      ...FIXTURES.group,
      createdAt: now,
      updatedAt: now,
    });

    const result = assembleContract(
      "order-create-contract",
      id => reg.get(id),
      (id, dir) => reg.getLinks(id, dir),
      id => BODIES.get(id),
    );

    expect(result).not.toBeNull();
    expect(result!.allSections.length).toBe(0);
    expect(result!.stats.completeness).toBe(0);
  });
});

describe("assembleContract — 텍스트 렌더링", () => {
  const reg = buildRegistry();

  const assembled = assembleContract(
    "order-create-contract",
    id => reg.get(id),
    (id, dir) => reg.getLinks(id, dir),
    id => BODIES.get(id),
  )!;

  it("제목에 '계약'이 포함된다", () => {
    expect(assembled.text).toContain("# 주문 생성 계약 — 계약");
  });

  it("렌더링 순서가 guard → boundary → steps → branch → verify", () => {
    const preIdx = assembled.text.indexOf("사전 조건");
    const inputIdx = assembled.text.indexOf("입력 (");
    const outputIdx = assembled.text.indexOf("출력 (");
    const stepIdx = assembled.text.indexOf("실행 단계");
    const branchIdx = assembled.text.indexOf("분기 지점");
    const failIdx = assembled.text.indexOf("실패 조건");
    const postIdx = assembled.text.indexOf("사후 조건");
    const evidIdx = assembled.text.indexOf("증거 요구");

    expect(preIdx).toBeLessThan(inputIdx);
    expect(inputIdx).toBeLessThan(outputIdx);
    expect(outputIdx).toBeLessThan(stepIdx);
    expect(stepIdx).toBeLessThan(branchIdx);
    expect(branchIdx).toBeLessThan(failIdx);
    expect(failIdx).toBeLessThan(postIdx);
    expect(postIdx).toBeLessThan(evidIdx);
  });
});

// ─── 가역성 (Reversibility) ────────────────────────────

describe("parseEvidenceItems", () => {
  it("[reversible] 어노테이션을 파싱한다", () => {
    const items = parseEvidenceItems(
      "- 입력 정규화 로그 [reversible]\n- 재고 결과 [reversible]",
      "doc-1",
    );
    expect(items.length).toBe(2);
    expect(items[0].description).toBe("입력 정규화 로그");
    expect(items[0].reversibility).toBe("reversible");
    expect(items[0].raw).toBe("입력 정규화 로그 [reversible]");
  });

  it("[irreversible] 어노테이션을 파싱한다", () => {
    const items = parseEvidenceItems(
      "- verdict 판정 [irreversible]",
      "doc-1",
    );
    expect(items[0].reversibility).toBe("irreversible");
    expect(items[0].description).toBe("verdict 판정");
  });

  it("어노테이션이 없으면 reversibility = null", () => {
    const items = parseEvidenceItems(
      "- 처리 시간\n- 응답 코드",
      "doc-1",
    );
    expect(items.length).toBe(2);
    expect(items[0].reversibility).toBeNull();
    expect(items[1].reversibility).toBeNull();
  });

  it("혼합된 어노테이션을 올바르게 파싱한다", () => {
    const items = parseEvidenceItems(
      "- raw event log [reversible]\n- 집계 메트릭 [irreversible]\n- 기타 로그",
      "doc-1",
    );
    expect(items[0].reversibility).toBe("reversible");
    expect(items[1].reversibility).toBe("irreversible");
    expect(items[2].reversibility).toBeNull();
  });

  it("불릿이 아닌 줄은 무시한다", () => {
    const items = parseEvidenceItems(
      "이것은 설명이다\n- 실제 항목 [reversible]\n또 설명",
      "doc-1",
    );
    expect(items.length).toBe(1);
  });
});

describe("parsedEvidence in AssembledContract", () => {
  const reg = buildRegistry();

  const assembled = assembleContract(
    "order-create-contract",
    id => reg.get(id),
    (id, dir) => reg.getLinks(id, dir),
    id => BODIES.get(id),
  )!;

  it("parsedEvidence에 4개 항목이 있다", () => {
    expect(assembled.parsedEvidence.length).toBe(4);
  });

  it("3개 reversible, 1개 irreversible", () => {
    const rev = assembled.parsedEvidence.filter(e => e.reversibility === "reversible");
    const irrev = assembled.parsedEvidence.filter(e => e.reversibility === "irreversible");
    expect(rev.length).toBe(3);
    expect(irrev.length).toBe(1);
  });

  it("irreversible 항목은 '저장 성공 여부'다", () => {
    const irrev = assembled.parsedEvidence.find(e => e.reversibility === "irreversible");
    expect(irrev!.description).toBe("저장 성공 여부");
  });

  it("sourceId가 원본 문서를 가리킨다", () => {
    for (const item of assembled.parsedEvidence) {
      expect(item.sourceId).toBe("order-create-evidence");
    }
  });
});
