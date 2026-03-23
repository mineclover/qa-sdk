import { describe, expect, it } from "vitest";
import {
  FlowSchemaBuilder,
  FlowEngine,
  buildCoordinateSpace,
  createFlowIndex,
  encodeSelections,
  decodePath,
  resolveDeepPath,
  constraintForGate,
  validateFlowSchema,
  evaluateCondition,
  tryAutoSelect,
} from "./index.js";
import type { FlowSchema, FlowPolicy } from "./types.js";

// ─── 테스트용 스키마 ─────────────────────────────────────

function createApprovalSchema(): FlowSchema {
  return new FlowSchemaBuilder("feature-approval", "기능 승인")
    .description("기능 개발 승인 의사결정 플로우")
    .gate("risk", "위험도 평가", "perceive", [
      { id: "low", label: "낮음" },
      { id: "medium", label: "보통" },
      { id: "high", label: "높음" },
      { id: "critical", label: "치명적" },
    ])
    .gate("priority", "우선순위", "evaluate", [
      { id: "p0", label: "긴급" },
      { id: "p1", label: "높음" },
      { id: "p2", label: "보통" },
    ])
    .gate("approval", "승인 레벨", "decide", [
      { id: "auto", label: "자동 승인" },
      { id: "lead", label: "팀 리드" },
      { id: "director", label: "디렉터" },
    ])
    .outcome("approved", "승인됨")
    .outcome("rejected", "반려됨")
    .build();
}

// ─── 스키마 검증 ─────────────────────────────────────────

describe("validateFlowSchema", () => {
  it("유효한 스키마는 통과한다", () => {
    const schema = createApprovalSchema();
    const result = validateFlowSchema(schema);
    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.level === "error")).toHaveLength(0);
  });

  it("gate ID 중복 시 에러", () => {
    const result = validateFlowSchema({
      id: "test",
      name: "test",
      description: "",
      version: "v1",
      gates: [
        { id: "dup", name: "A", phase: "decide", branches: [{ id: "a", label: "A" }] },
        { id: "dup", name: "B", phase: "decide", branches: [{ id: "b", label: "B" }] },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.message.includes("중복"))).toBe(true);
  });

  it("branches도 subFlowId도 없으면 에러", () => {
    const result = validateFlowSchema({
      id: "test",
      name: "test",
      description: "",
      version: "v1",
      gates: [{ id: "empty", name: "빈 gate", phase: "decide" }],
    });
    expect(result.valid).toBe(false);
  });
});

// ─── FlowSchemaBuilder ──────────────────────────────────

describe("FlowSchemaBuilder", () => {
  it("플루언트 API로 스키마를 빌드한다", () => {
    const schema = createApprovalSchema();
    expect(schema.id).toBe("feature-approval");
    expect(schema.gates).toHaveLength(3);
    expect(schema.gates[0].branches).toHaveLength(4);
    expect(schema.gates[0].phase).toBe("perceive");
    expect(schema.outcomes).toHaveLength(2);
  });

  it("subFlowGate를 포함할 수 있다", () => {
    const schema = new FlowSchemaBuilder("with-sub", "하위 플로우 포함")
      .gate("scope", "범위", "perceive", [
        { id: "small", label: "소" },
        { id: "large", label: "대" },
      ])
      .subFlowGate("planning", "계획", "plan", "detailed-planning")
      .build();

    expect(schema.gates[1].subFlowId).toBe("detailed-planning");
    expect(schema.gates[1].branches).toBeUndefined();
  });

  it("유효하지 않은 스키마는 build() 시 throw", () => {
    expect(() =>
      new FlowSchemaBuilder("bad", "잘못된 스키마").build(),
    ).toThrow("검증 실패");
  });
});

// ─── 좌표 매핑 ───────────────────────────────────────────

describe("coordinate", () => {
  it("좌표 공간을 올바르게 구성한다", () => {
    const schema = createApprovalSchema();
    const space = buildCoordinateSpace(schema);
    expect(space.shape).toEqual([4, 3, 3]); // risk(4) × priority(3) × approval(3)
    expect(space.totalPaths).toBe(36);
    expect(space.labels).toEqual(["risk", "priority", "approval"]);
  });

  it("WeightedIndex를 생성한다", () => {
    const schema = createApprovalSchema();
    const wi = createFlowIndex(schema);
    expect(wi.size).toBe(36);
    expect(wi.shape).toEqual([4, 3, 3]);
  });

  it("선택 → 인코딩 → 디코딩 라운드트립", () => {
    const schema = createApprovalSchema();

    // risk=high, priority=p1, approval=director
    const selections = [
      { gateId: "risk", branchId: "high", evidence: [], confidence: 0.8, timestamp: "", durationMs: 0 },
      { gateId: "priority", branchId: "p1", evidence: [], confidence: 0.7, timestamp: "", durationMs: 0 },
      { gateId: "approval", branchId: "director", evidence: [], confidence: 0.9, timestamp: "", durationMs: 0 },
    ] as const;

    const address = encodeSelections(schema, selections);
    const decoded = decodePath(schema, address);

    expect(decoded.selections).toEqual({
      risk: "high",
      priority: "p1",
      approval: "director",
    });
    expect(decoded.address).toBe(address);
  });

  it("전체 주소 공간 라운드트립", () => {
    const schema = createApprovalSchema();
    const space = buildCoordinateSpace(schema);

    for (let addr = 0; addr < space.totalPaths; addr++) {
      const decoded = decodePath(schema, addr);
      const reEncoded = encodeSelections(schema, [
        { gateId: "risk", branchId: decoded.selections.risk, evidence: [], confidence: 1, timestamp: "", durationMs: 0 },
        { gateId: "priority", branchId: decoded.selections.priority, evidence: [], confidence: 1, timestamp: "", durationMs: 0 },
        { gateId: "approval", branchId: decoded.selections.approval, evidence: [], confidence: 1, timestamp: "", durationMs: 0 },
      ]);
      expect(reEncoded).toBe(addr);
    }
  });

  it("subFlow를 포함한 좌표 매핑", () => {
    const mainSchema = new FlowSchemaBuilder("main", "메인 플로우")
      .gate("scope", "범위", "perceive", [
        { id: "small", label: "소" },
        { id: "large", label: "대" },
      ])
      .subFlowGate("planning", "계획", "plan", "sub-planning")
      .build();

    const subSchema = new FlowSchemaBuilder("sub-planning", "하위 계획")
      .gate("arch", "아키텍처", "evaluate", [
        { id: "extend", label: "확장" },
        { id: "refactor", label: "리팩터" },
        { id: "new", label: "신규" },
      ])
      .gate("timeline", "일정", "plan", [
        { id: "1sprint", label: "1스프린트" },
        { id: "2sprints", label: "2스프린트" },
      ])
      .build();

    const subCapacities = new Map([["sub-planning", 6]]); // 3×2
    const space = buildCoordinateSpace(mainSchema, subCapacities);
    expect(space.shape).toEqual([2, 6]); // scope(2) × planning(6 paths)
    expect(space.totalPaths).toBe(12);
    expect(space.subFlowRefs.get(1)).toBe("sub-planning");
  });

  it("constraintForGate로 범위 질의 제약 생성", () => {
    const schema = createApprovalSchema();
    const constraint = constraintForGate(schema, "risk", ["high", "critical"]);
    expect(constraint.dimIndex).toBe(0);
    expect(constraint.positions).toEqual([3, 4]); // 1-based
  });
});

// ─── 하위 플로우 재귀 해석 ───────────────────────────────

describe("resolveDeepPath", () => {
  it("subFlow 참조를 재귀 해석한다", () => {
    const mainSchema: FlowSchema = {
      id: "main",
      name: "메인",
      description: "",
      version: "v1",
      gates: [
        { id: "scope", name: "범위", phase: "perceive", branches: [
          { id: "small", label: "소" },
          { id: "large", label: "대" },
        ]},
        { id: "planning", name: "계획", phase: "plan", subFlowId: "sub" },
      ],
    };

    const subSchema: FlowSchema = {
      id: "sub",
      name: "하위",
      description: "",
      version: "v1",
      gates: [
        { id: "arch", name: "아키텍처", phase: "evaluate", branches: [
          { id: "extend", label: "확장" },
          { id: "new", label: "신규" },
        ]},
      ],
    };

    const schemas = new Map([["main", mainSchema], ["sub", subSchema]]);
    const subCapacities = new Map([["sub", 2]]);

    // address 0: scope=small(0-based:0), planning=sub address 0 (arch=extend)
    const result = resolveDeepPath(schemas, "main", 0, subCapacities);
    expect(result.scope).toBe("small");
    expect(result.planning).toEqual({ arch: "extend" });
  });
});

// ─── FlowEngine ──────────────────────────────────────────

describe("FlowEngine", () => {
  it("플로우 시작 → 분기 선택 → 완료", () => {
    const engine = new FlowEngine();
    const schema = createApprovalSchema();
    engine.registerSchema(schema);

    const inst = engine.startFlow("feature-approval", { team: "payments" });
    expect(inst.status).toBe("active");
    expect(inst.schemaId).toBe("feature-approval");

    // 순차 선택
    engine.selectBranch(inst.id, "high", [
      { kind: "data", source: "scan", content: "외부 API 포함", weight: 0.9 },
    ]);
    engine.selectBranch(inst.id, "p1");
    const result = engine.selectBranch(inst.id, "director");

    expect(result.status).toBe("completed");
    expect(result.selections).toHaveLength(3);
    expect(result.coordinateAddress).toBeDefined();
    expect(typeof result.coordinateAddress).toBe("number");
  });

  it("getCurrentGate가 순차적으로 진행한다", () => {
    const engine = new FlowEngine();
    engine.registerSchema(createApprovalSchema());
    const inst = engine.startFlow("feature-approval");

    expect(engine.getCurrentGate(inst.id)?.id).toBe("risk");
    engine.selectBranch(inst.id, "low");
    expect(engine.getCurrentGate(inst.id)?.id).toBe("priority");
    engine.selectBranch(inst.id, "p2");
    expect(engine.getCurrentGate(inst.id)?.id).toBe("approval");
    engine.selectBranch(inst.id, "auto");
    expect(engine.getCurrentGate(inst.id)).toBeNull();
  });

  it("terminal branch 선택 시 즉시 완료", () => {
    const schema = new FlowSchemaBuilder("with-terminal", "종료 분기 포함")
      .gate("check", "확인", "perceive", [
        { id: "pass", label: "통과" },
        { id: "reject", label: "반려", terminal: true },
      ])
      .gate("action", "행동", "execute", [
        { id: "proceed", label: "진행" },
      ])
      .build();

    const engine = new FlowEngine();
    engine.registerSchema(schema);
    const inst = engine.startFlow("with-terminal");

    const result = engine.selectBranch(inst.id, "reject");
    expect(result.status).toBe("completed");
    expect(result.selections).toHaveLength(1);
  });

  it("플로우 포기", () => {
    const engine = new FlowEngine();
    engine.registerSchema(createApprovalSchema());
    const inst = engine.startFlow("feature-approval");

    engine.selectBranch(inst.id, "critical");
    const abandoned = engine.abandonFlow(inst.id, "상위 프로젝트 취소");
    expect(abandoned.status).toBe("abandoned");
    expect(abandoned.context).toHaveProperty("abandonReason", "상위 프로젝트 취소");
  });

  it("인스턴스 목록 조회 + 필터", () => {
    const engine = new FlowEngine();
    engine.registerSchema(createApprovalSchema());
    engine.startFlow("feature-approval");
    engine.startFlow("feature-approval");

    expect(engine.listInstances()).toHaveLength(2);
    expect(engine.listInstances({ status: "active" })).toHaveLength(2);
    expect(engine.listInstances({ status: "completed" })).toHaveLength(0);
  });
});

// ─── 정책 엔진 ───────────────────────────────────────────

describe("policy", () => {
  it("조건 평가가 올바르게 동작한다", () => {
    expect(evaluateCondition({ field: "hours", op: "lt", value: 8 }, { hours: 4 })).toBe(true);
    expect(evaluateCondition({ field: "hours", op: "lt", value: 8 }, { hours: 10 })).toBe(false);
    expect(evaluateCondition({ field: "type", op: "eq", value: "bug" }, { type: "bug" })).toBe(true);
    expect(evaluateCondition({ field: "type", op: "in", value: ["bug", "hotfix"] }, { type: "bug" })).toBe(true);
    expect(evaluateCondition({ field: "name", op: "exists", value: true }, { name: "test" })).toBe(true);
    expect(evaluateCondition({ field: "name", op: "exists", value: true }, {})).toBe(false);
  });

  it("dot-notation 경로를 해석한다", () => {
    const ctx = { context: { team: { size: 5 } } };
    expect(evaluateCondition({ field: "context.team.size", op: "gt", value: 3 }, ctx)).toBe(true);
  });

  it("정책 기반 자동 선택", () => {
    const policy: FlowPolicy = {
      id: "auto-low",
      name: "저위험 자동 승인",
      flowId: "feature-approval",
      priority: 100,
      conditions: [
        { field: "gate.risk.branch", op: "eq", value: "low" },
      ],
      action: { gateId: "approval", branchId: "auto", confidence: 0.95 },
      rationale: "저위험은 자동 승인",
    };

    const priorSelections = [
      { gateId: "risk", branchId: "low", evidence: [], confidence: 0.9, timestamp: "", durationMs: 0 },
      { gateId: "priority", branchId: "p2", evidence: [], confidence: 0.8, timestamp: "", durationMs: 0 },
    ];

    const action = tryAutoSelect([policy], "approval", {}, priorSelections);
    expect(action).not.toBeNull();
    expect(action!.branchId).toBe("auto");
  });

  it("엔진의 autoSelect가 정책을 적용한다", () => {
    const engine = new FlowEngine();
    engine.registerSchema(createApprovalSchema());
    engine.registerPolicy({
      id: "auto-low-p2",
      name: "저위험+보통 자동 승인",
      flowId: "feature-approval",
      priority: 100,
      conditions: [
        { field: "gate.risk.branch", op: "eq", value: "low" },
        { field: "gate.priority.branch", op: "eq", value: "p2" },
      ],
      action: { gateId: "approval", branchId: "auto", confidence: 0.95 },
      rationale: "저위험+보통 우선순위는 자동 승인",
    });

    const inst = engine.startFlow("feature-approval");
    engine.selectBranch(inst.id, "low");
    engine.selectBranch(inst.id, "p2");

    const result = engine.autoSelect(inst.id);
    expect(result).not.toBeNull();
    expect(result!.status).toBe("completed");
    expect(result!.selections[2].branchId).toBe("auto");
  });
});
