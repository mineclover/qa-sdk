// @def.doc definition-catalog-spec

/**
 * 워크플로우 합성 검증 — compileWorkflow로 계약을 실행 가능한 DAG로 변환할 수 있는가
 */

import { describe, it, expect } from "vitest";
import { compileWorkflow, reflect } from "./workflow.js";
import { assembleContract } from "./contract.js";
import { MemoryDefinitionRegistry } from "./registry.js";
import type { DefinitionEntry } from "./types.js";

// ─── 테스트 fixture (contract.test.ts와 동일 구조) ────────

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

const BODIES = new Map<string, string>([
  ["order-contract", `# 주문 생성 계약

## 목적 ^purpose

주문 생성의 전체 계약.
`],

  ["order-api", `# 주문 API

## 목적 ^purpose

주문 API 정의.

## 입력 ^inputs

- user_id: string (필수)
- items: Item[] (필수)
- payment_method: string (필수)

## 출력 ^outputs

- order_id: string
- status: "CREATED" | "REJECTED"
- rejected_reason?: string
`],

  ["order-precond", `# 주문 사전 조건

## 목적 ^purpose

사전 조건.

## 사전 조건 ^precondition

1. user_id는 유효한 사용자여야 한다
2. items는 비어 있지 않아야 한다
`],

  ["order-flow", `# 주문 흐름

## 목적 ^purpose

흐름 정의.

## 실행 단계 ^flow-steps

1. 요청 payload를 정규화한다
2. 상품 목록 유효성을 확인한다
3. 결제 가능 여부를 확인한다
4. 주문 엔티티를 생성한다
5. 결과를 반환한다

## 분기 지점 ^decision-point

- 재고 부족 시 주문 중단
- 결제 불가 시 주문 거부
`],

  ["order-failures", `# 주문 실패

## 목적 ^purpose

실패 조건.

## 실패 조건 ^failure

- invalid_user: 유효하지 않은 사용자
- out_of_stock: 재고 부족
`],

  ["order-evidence", `# 주문 증거

## 목적 ^purpose

증거 요구.

## 증거 요구 ^evidence

- 입력 정규화 로그 [reversible]
- 재고 검증 결과 [reversible]
- 저장 성공 여부 [irreversible]
`],

  ["order-postcond", `# 주문 사후 조건

## 목적 ^purpose

사후 조건.

## 사후 조건 ^postcondition

1. order_id는 성공 시 존재
2. status는 CREATED 또는 REJECTED
`],
]);

function buildContract() {
  const reg = new MemoryDefinitionRegistry();

  const entries: DefinitionEntry[] = [
    entry("order-contract", "feature", "func_def", "overview", "주문 생성 계약"),
    entry("order-api", "interface", "api_contract", "specification", "주문 API"),
    entry("order-precond", "constraint", "biz_constraint", "specification", "주문 사전 조건"),
    entry("order-flow", "flow", "process_flow", "implementation", "주문 흐름"),
    entry("order-failures", "state", "system_state", "specification", "주문 실패"),
    entry("order-evidence", "feature", "scenario", "validation", "주문 증거"),
    entry("order-postcond", "constraint", "tech_constraint", "validation", "주문 사후 조건"),
  ];

  for (const e of entries) reg.register({ ...e });

  const members = entries.filter(e => e.id !== "order-contract");
  for (const m of members) reg.link("order-contract", m.id, "contains");

  return assembleContract(
    "order-contract",
    id => reg.get(id),
    (id, dir) => reg.getLinks(id, dir),
    id => BODIES.get(id),
  )!;
}

// ─── 테스트 ─────────────────────────────────────────────

describe("compileWorkflow", () => {
  const contract = buildContract();
  const workflow = compileWorkflow(contract);

  it("workflowId가 계약에서 파생된다", () => {
    expect(workflow.workflowId).toBe("wf.order-contract.v1");
  });

  it("derivedFrom에 그룹 + 멤버 ID가 포함된다", () => {
    expect(workflow.derivedFrom).toContain("order-contract");
    expect(workflow.derivedFrom).toContain("order-api");
    expect(workflow.derivedFrom).toContain("order-flow");
  });

  it("노드가 생성된다", () => {
    expect(workflow.nodes.length).toBeGreaterThan(0);
  });

  it("엣지가 노드를 연결한다", () => {
    expect(workflow.edges.length).toBeGreaterThan(0);
    // 모든 엣지의 from/to가 실제 노드를 참조
    const nodeIds = new Set(workflow.nodes.map(n => n.nodeId));
    for (const edge of workflow.edges) {
      expect(nodeIds.has(edge.from), `엣지 from=${edge.from} 노드 미존재`).toBe(true);
      expect(nodeIds.has(edge.to), `엣지 to=${edge.to} 노드 미존재`).toBe(true);
    }
  });

  it("자기 루프가 없다", () => {
    for (const edge of workflow.edges) {
      expect(edge.from).not.toBe(edge.to);
    }
  });
});

describe("워크플로우 노드 구조", () => {
  const contract = buildContract();
  const workflow = compileWorkflow(contract);

  it("guard 노드가 precondition에서 생성된다", () => {
    const guards = workflow.nodes.filter(n => n.sourceMarker === "guard");
    expect(guards.length).toBeGreaterThanOrEqual(1);
    expect(guards[0].mode).toBe("code");
  });

  it("flow-steps에서 개별 step 노드가 생성된다", () => {
    const steps = workflow.nodes.filter(n => n.sourceMarker === "flow-steps");
    // 5개 step (번호 목록 5줄)
    expect(steps.length).toBe(5);
  });

  it("step 노드의 mode는 키워드 기반으로 분류된다", () => {
    const steps = workflow.nodes.filter(n => n.sourceMarker === "flow-steps");
    // "정규화" → code, "유효성 확인" → code, "결제 확인" → code
    expect(steps[0].mode).toBe("code"); // 정규화
    expect(steps[1].mode).toBe("code"); // 유효성 확인
    expect(steps[2].mode).toBe("code"); // 결제 확인
    // "생성한다" → llm (키워드 매칭)
    expect(steps[3].mode).toBe("llm");
    // "반환한다" → code
    expect(steps[4].mode).toBe("code");
  });

  it("decision-point에서 분기 노드가 생성된다", () => {
    const branches = workflow.nodes.filter(n => n.sourceMarker === "decision-point");
    // 2개 분기 (재고 부족, 결제 불가)
    expect(branches.length).toBe(2);
    // decision-point의 modeHint는 llm
    for (const b of branches) {
      expect(b.mode).toBe("llm");
    }
  });

  it("inputs/outputs 노드가 생성된다", () => {
    const inputs = workflow.nodes.filter(n => n.sourceMarker === "inputs");
    const outputs = workflow.nodes.filter(n => n.sourceMarker === "outputs");
    expect(inputs.length).toBe(1);
    expect(outputs.length).toBe(1);
  });

  it("evidence 노드가 가역성 속성과 함께 생성된다", () => {
    const evidences = workflow.nodes.filter(n => n.sourceMarker === "evidence");
    // 3개 증거 항목
    expect(evidences.length).toBe(3);
    for (const e of evidences) {
      expect(e.mode).toBe("code");
    }

    // 가역성 검증
    const reversible = evidences.filter(e => e.reversibility === "reversible");
    const irreversible = evidences.filter(e => e.reversibility === "irreversible");
    expect(reversible.length).toBe(2);
    expect(irreversible.length).toBe(1);
    expect(irreversible[0].operation).toContain("저장 성공 여부");
  });

  it("failure 노드가 생성된다", () => {
    const failures = workflow.nodes.filter(n => n.sourceMarker === "failure");
    // 2개 실패 조건
    expect(failures.length).toBe(2);
  });

  it("evidence가 아닌 노드는 reversibility = null", () => {
    const nonEvidence = workflow.nodes.filter(n => n.sourceMarker !== "evidence");
    for (const node of nonEvidence) {
      expect(node.reversibility, `${node.nodeId}(${node.sourceMarker})의 reversibility가 null이 아님`).toBeNull();
    }
  });
});

describe("엣지 topology", () => {
  const contract = buildContract();
  const workflow = compileWorkflow(contract);

  it("guard → input 엣지가 있다", () => {
    const guardEdges = workflow.edges.filter(e => e.kind === "guard");
    expect(guardEdges.length).toBeGreaterThan(0);
  });

  it("sequence 엣지로 step이 순차 연결된다", () => {
    const seqEdges = workflow.edges.filter(e => e.kind === "sequence");
    expect(seqEdges.length).toBeGreaterThan(0);

    // step 노드들이 순서대로 연결
    const steps = workflow.nodes.filter(n => n.sourceMarker === "flow-steps");
    for (let i = 1; i < steps.length; i++) {
      const edge = seqEdges.find(
        e => e.from === steps[i - 1].nodeId && e.to === steps[i].nodeId,
      );
      expect(edge, `step ${i-1} → step ${i} 연결 없음`).toBeDefined();
    }
  });

  it("branch 엣지가 존재한다", () => {
    const branchEdges = workflow.edges.filter(e => e.kind === "branch");
    expect(branchEdges.length).toBeGreaterThan(0);
  });

  it("verify 엣지로 evidence가 연결된다", () => {
    const verifyEdges = workflow.edges.filter(e => e.kind === "verify");
    expect(verifyEdges.length).toBeGreaterThan(0);
  });
});

describe("validators", () => {
  const contract = buildContract();
  const workflow = compileWorkflow(contract);

  it("pre-phase validator가 precondition에서 생성된다", () => {
    const preValidators = workflow.validators.filter(v => v.phase === "pre");
    // 2개 precondition에서 1 validator씩 (guard 노드 단위)
    expect(preValidators.length).toBeGreaterThanOrEqual(1);
  });

  it("post-phase validator가 postcondition에서 생성된다", () => {
    const postValidators = workflow.validators.filter(v => v.phase === "post");
    // 2개 postcondition 항목
    expect(postValidators.length).toBe(2);
  });

  it("validator의 appliesTo가 실제 노드를 참조한다", () => {
    const nodeIds = new Set(workflow.nodes.map(n => n.nodeId));
    for (const v of workflow.validators) {
      for (const target of v.appliesTo) {
        expect(nodeIds.has(target), `validator ${v.validatorId} → ${target} 노드 미존재`).toBe(true);
      }
    }
  });
});

describe("WorkflowMetadata (MAP-Elites axes)", () => {
  const contract = buildContract();
  const workflow = compileWorkflow(contract);

  it("totalNodes = nodes.length", () => {
    expect(workflow.metadata.totalNodes).toBe(workflow.nodes.length);
  });

  it("codeNodes + llmNodes = totalNodes", () => {
    expect(workflow.metadata.codeNodes + workflow.metadata.llmNodes)
      .toBe(workflow.metadata.totalNodes);
  });

  it("semanticDensity = llm / total", () => {
    const expected = workflow.metadata.llmNodes / workflow.metadata.totalNodes;
    expect(workflow.metadata.semanticDensity).toBeCloseTo(expected);
  });

  it("validationDensity > 0 (validator가 존재)", () => {
    expect(workflow.metadata.validationDensity).toBeGreaterThan(0);
  });

  it("branchingFactor = decision-point 노드 수", () => {
    const branchNodes = workflow.nodes.filter(n => n.sourceMarker === "decision-point");
    expect(workflow.metadata.branchingFactor).toBe(branchNodes.length);
  });

  it("contractCompleteness가 원본 계약에서 전달된다", () => {
    expect(workflow.metadata.contractCompleteness).toBe(contract.stats.completeness);
  });
});

describe("reflect", () => {
  const contract = buildContract();
  const workflow = compileWorkflow(contract);
  const firstStep = workflow.nodes.find(n => n.sourceMarker === "flow-steps");

  it("code 노드에서 의미 해석 에러 → mode 문제 분류", () => {
    const results = reflect(
      workflow,
      [firstStep!.nodeId],
      ["ambiguous input detected"],
    );
    expect(results.length).toBe(1);
    expect(results[0].issueLayer).toBe("mode");
  });

  it("post-validator 없는 노드 실패 → validator 문제 분류", () => {
    // guard 노드에는 pre-validator만 있고 post는 없음
    const firstGuard = workflow.nodes.find(n => n.sourceMarker === "guard");
    const results = reflect(
      workflow,
      [firstGuard!.nodeId],
      ["validation failed"],
    );
    expect(results.length).toBe(1);
    expect(results[0].issueLayer).toBe("validator");
  });

  it("빈 failedNodeIds → 빈 결과", () => {
    const results = reflect(workflow, [], ["error"]);
    expect(results.length).toBe(0);
  });
});

describe("classifyStepMode — llm 키워드 감지", () => {
  it("판단 키워드가 있는 step은 llm으로 분류된다", () => {
    const reg = new MemoryDefinitionRegistry();
    reg.register(entry("llm-contract", "feature", "func_def", "overview", "LLM 계약"));
    reg.register(entry("llm-flow", "flow", "process_flow", "implementation", "LLM 흐름"));
    reg.link("llm-contract", "llm-flow", "contains");

    const bodies = new Map([
      ["llm-contract", "## 목적 ^purpose\nLLM 테스트"],
      ["llm-flow", `## 목적 ^purpose
흐름

## 실행 단계 ^flow-steps

1. 데이터를 분류한다
2. 결과를 해석한다
3. 보고서를 생성한다
4. 파일을 저장한다
`],
    ]);

    const contract = assembleContract(
      "llm-contract",
      id => reg.get(id),
      (id, dir) => reg.getLinks(id, dir),
      id => bodies.get(id),
    )!;

    const workflow = compileWorkflow(contract);
    const steps = workflow.nodes.filter(n => n.sourceMarker === "flow-steps");

    // "분류한다" → llm
    expect(steps[0].mode).toBe("llm");
    // "해석한다" → llm
    expect(steps[1].mode).toBe("llm");
    // "생성한다" → llm
    expect(steps[2].mode).toBe("llm");
    // "저장한다" → code (키워드 없음)
    expect(steps[3].mode).toBe("code");
  });
});

describe("version 파라미터", () => {
  const contract = buildContract();

  it("기본 버전은 1이다", () => {
    const wf = compileWorkflow(contract);
    expect(wf.version).toBe(1);
    expect(wf.workflowId).toContain("v1");
  });

  it("버전을 지정할 수 있다", () => {
    const wf = compileWorkflow(contract, 3);
    expect(wf.version).toBe(3);
    expect(wf.workflowId).toContain("v3");
  });
});
