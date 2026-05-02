import { describe, expect, it } from "vitest";
import {
  FORCING_QUESTIONS_FLOW,
  OFFICE_HOURS_FLOW,
  CEO_REVIEW_FLOW,
  ENG_REVIEW_FLOW,
  DESIGN_REVIEW_FLOW,
  CODE_REVIEW_FLOW,
  INVESTIGATION_FLOW,
  SHIP_FLOW,
  SPRINT_PIPELINE,
  AUTOPLAN_POLICIES,
  ALL_SPRINT_FLOWS,
  SPRINT_FLOW_REGISTRY,
} from "./sprint.js";
import {
  MENTAL_MODELS,
  FORCING_QUESTIONS,
  classifyEscalation,
} from "./mental-model.js";
import {
  FlowEngine,
  buildCoordinateSpace,
  decodePath,
  encodeSelections,
  validateFlowSchema,
} from "./index.js";
import type { GateSelection } from "./types.js";

// ─── 스프린트 파이프라인 스키마 검증 ─────────────────────

describe("sprint flow schemas", () => {
  it("모든 스프린트 플로우 스키마가 유효하다", () => {
    for (const flow of ALL_SPRINT_FLOWS) {
      const result = validateFlowSchema(flow);
      expect(result.valid, `${flow.id}: ${result.issues.map((i) => i.message).join(", ")}`).toBe(true);
    }
  });

  it("SPRINT_FLOW_REGISTRY에 모든 플로우가 등록되어 있다", () => {
    expect(SPRINT_FLOW_REGISTRY.size).toBe(ALL_SPRINT_FLOWS.length);
    for (const flow of ALL_SPRINT_FLOWS) {
      expect(SPRINT_FLOW_REGISTRY.get(flow.id)).toBe(flow);
    }
  });

  it("SPRINT_PIPELINE의 subFlow가 모두 레지스트리에 존재한다", () => {
    for (const gate of SPRINT_PIPELINE.gates) {
      if (gate.subFlowId) {
        expect(
          SPRINT_FLOW_REGISTRY.has(gate.subFlowId),
          `subFlow "${gate.subFlowId}" not in registry`,
        ).toBe(true);
      }
    }
  });
});

// ─── Office Hours 좌표 인코딩 ────────────────────────────

describe("office-hours flow", () => {
  // diagnostic은 forcing-questions subFlow를 참조 (3^6 = 729 경로)
  const fqCapacity = FORCING_QUESTIONS_FLOW.gates.reduce(
    (acc, g) => acc * (g.branches?.length ?? 1), 1,
  );
  const subFlowCapacities = new Map([["forcing-questions", fqCapacity]]);

  it("6개 gate, 좌표 공간 올바르게 구성 (diagnostic=subFlow)", () => {
    const space = buildCoordinateSpace(OFFICE_HOURS_FLOW, subFlowCapacities);
    expect(space.labels).toEqual(["context", "mode", "diagnostic", "landscape", "premise", "approach"]);
    // context(3) × mode(2) × diagnostic(729=FQ subFlow) × landscape(2) × premise(3) × approach(4)
    expect(space.totalPaths).toBe(3 * 2 * fqCapacity * 2 * 3 * 4);
  });

  it("구체적 경로 라운드트립 (subFlow 주소 포함)", () => {
    const subFlowAddr = 42; // FQ subFlow 내 특정 경로 주소
    const selections: GateSelection[] = [
      { gateId: "context", branchId: "new-idea", evidence: [], confidence: 0.8, timestamp: "", durationMs: 0 },
      { gateId: "mode", branchId: "startup", evidence: [], confidence: 0.9, timestamp: "", durationMs: 0 },
      { gateId: "diagnostic", branchId: "fq-result", evidence: [], confidence: 0.7, timestamp: "", durationMs: 0 },
      { gateId: "landscape", branchId: "search", evidence: [], confidence: 0.6, timestamp: "", durationMs: 0 },
      { gateId: "premise", branchId: "validated", evidence: [], confidence: 0.85, timestamp: "", durationMs: 0 },
      { gateId: "approach", branchId: "recommended", evidence: [], confidence: 0.9, timestamp: "", durationMs: 0 },
    ];

    const subFlowAddresses = new Map([["diagnostic", subFlowAddr]]);
    const address = encodeSelections(OFFICE_HOURS_FLOW, selections, subFlowAddresses, subFlowCapacities);
    const decoded = decodePath(OFFICE_HOURS_FLOW, address, subFlowCapacities);

    expect(decoded.selections.context).toBe("new-idea");
    expect(decoded.selections.mode).toBe("startup");
    // diagnostic은 subFlow 주소(0-based 문자열)
    expect(decoded.selections.diagnostic).toBe(String(subFlowAddr));
    expect(decoded.selections.landscape).toBe("search");
    expect(decoded.selections.premise).toBe("validated");
    expect(decoded.selections.approach).toBe("recommended");
  });
});

// ─── CEO Review 스코프 모드 ──────────────────────────────

describe("ceo-review flow", () => {
  it("4가지 스코프 모드가 정의되어 있다", () => {
    const scopeGate = CEO_REVIEW_FLOW.gates.find((g) => g.id === "scope-mode");
    expect(scopeGate).toBeDefined();
    expect(scopeGate!.branches).toHaveLength(4);
    expect(scopeGate!.branches!.map((b) => b.id)).toEqual([
      "expansion",
      "selective",
      "hold",
      "reduction",
    ]);
  });

  it("엔진으로 전체 플로우 실행", () => {
    const engine = new FlowEngine();
    engine.registerSchema(CEO_REVIEW_FLOW);

    const inst = engine.startFlow("ceo-review", { projectName: "qa-sdk" });
    engine.selectBranch(inst.id, "right-problem");
    engine.selectBranch(inst.id, "extend");
    engine.selectBranch(inst.id, "ideal");
    engine.selectBranch(inst.id, "expansion");
    engine.selectBranch(inst.id, "medium");
    const result = engine.selectBranch(inst.id, "multi-sprint");

    expect(result.status).toBe("completed");
    expect(result.coordinateAddress).toBeDefined();
  });
});

// ─── Investigation Iron Law ──────────────────────────────

describe("investigation flow", () => {
  it("terminal branch로 조기 종료 가능 (3-strike)", () => {
    const engine = new FlowEngine();
    engine.registerSchema(INVESTIGATION_FLOW);

    const inst = engine.startFlow("investigation");
    engine.selectBranch(inst.id, "intermittent");
    engine.selectBranch(inst.id, "narrowed");
    engine.selectBranch(inst.id, "direct-fix");
    const result = engine.selectBranch(inst.id, "failed"); // terminal

    expect(result.status).toBe("completed");
    expect(result.selections).toHaveLength(4);
  });
});

// ─── Mental Models ───────────────────────────────────────

describe("mental models", () => {
  it("13개 인지 모델이 정의되어 있다", () => {
    expect(Object.keys(MENTAL_MODELS)).toHaveLength(13);
  });

  it("모든 모델에 question과 antiPattern이 있다", () => {
    for (const [id, model] of Object.entries(MENTAL_MODELS)) {
      expect(model.id).toBe(id);
      expect(model.question.length).toBeGreaterThan(0);
      expect(model.antiPattern.length).toBeGreaterThan(0);
    }
  });
});

// ─── Forcing Questions ───────────────────────────────────

describe("forcing questions", () => {
  it("6개 Forcing Questions가 정의되어 있다", () => {
    expect(FORCING_QUESTIONS).toHaveLength(6);
  });

  it("각 질문에 pushBackOn이 정의되어 있다", () => {
    for (const q of FORCING_QUESTIONS) {
      expect(q.pushBackOn.length).toBeGreaterThan(0);
    }
  });
});

// ─── Escalation Classification ───────────────────────────

describe("escalation", () => {
  it("표준 패턴은 자동 처리", () => {
    const result = classifyEscalation(["standard-pattern"]);
    expect(result.isTasteDecision).toBe(false);
    expect(result.principle).toBe("standard-pattern");
  });

  it("테스트 추가는 자동 승인", () => {
    const result = classifyEscalation(["test-coverage"]);
    expect(result.isTasteDecision).toBe(false);
  });

  it("어디에도 해당 안 되면 taste decision", () => {
    const result = classifyEscalation(["taste"]);
    expect(result.isTasteDecision).toBe(true);
    expect(result.principle).toBe("taste");
  });

  it("빈 태그도 taste decision", () => {
    const result = classifyEscalation([]);
    expect(result.isTasteDecision).toBe(true);
  });
});

// ─── Autoplan Policies ───────────────────────────────────

describe("autoplan policies", () => {
  it("정책이 올바른 flowId를 참조한다", () => {
    for (const policy of AUTOPLAN_POLICIES) {
      expect(
        SPRINT_FLOW_REGISTRY.has(policy.flowId),
        `policy "${policy.id}" references non-existent flow "${policy.flowId}"`,
      ).toBe(true);
    }
  });

  it("정책의 gateId가 참조 flow에 존재한다", () => {
    for (const policy of AUTOPLAN_POLICIES) {
      const flow = SPRINT_FLOW_REGISTRY.get(policy.flowId)!;
      const gateExists = flow.gates.some((g) => g.id === policy.action.gateId);
      expect(
        gateExists,
        `policy "${policy.id}" references non-existent gate "${policy.action.gateId}" in flow "${policy.flowId}"`,
      ).toBe(true);
    }
  });

  it("정책의 branchId가 참조 gate에 존재한다", () => {
    for (const policy of AUTOPLAN_POLICIES) {
      const flow = SPRINT_FLOW_REGISTRY.get(policy.flowId)!;
      const gate = flow.gates.find((g) => g.id === policy.action.gateId)!;
      if (gate.branches) {
        const branchExists = gate.branches.some((b) => b.id === policy.action.branchId);
        expect(
          branchExists,
          `policy "${policy.id}" references non-existent branch "${policy.action.branchId}"`,
        ).toBe(true);
      }
    }
  });

  it("엔진에서 autoplan 정책이 작동한다", () => {
    const engine = new FlowEngine();
    engine.registerSchema(CODE_REVIEW_FLOW);
    for (const policy of AUTOPLAN_POLICIES.filter((p) => p.flowId === "code-review")) {
      engine.registerPolicy(policy);
    }

    const inst = engine.startFlow("code-review");
    engine.selectBranch(inst.id, "on-scope");
    engine.selectBranch(inst.id, "clean");

    // auto-low-risk-approve 정책이 적용되어야 함
    const result = engine.autoSelect(inst.id);
    expect(result).not.toBeNull();
    expect(result!.selections[2].branchId).toBe("approve");
  });
});
