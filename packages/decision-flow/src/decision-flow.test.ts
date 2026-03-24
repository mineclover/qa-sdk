import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FlowSchemaBuilder,
  FlowEngine,
  MemoryInstanceStore,
  getAnnotatedDesignFlow,
  buildCoordinateSpace,
  createFlowIndex,
  encodeSelections,
  decodePath,
  resolveDeepPath,
  constraintForGate,
  validateFlowSchema,
  evaluateCondition,
  tryAutoSelect,
  detectPatterns,
  generatePolicyCandidates,
  PolicyCandidateWorkflow,
  diffInstances,
  gateDistribution,
  compareTimeRanges,
  createComparisonReport,
} from "./index.js";
import type { FlowSchema, FlowPolicy, FlowInstance } from "./types.js";

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

  it("완료된 인스턴스를 instanceStore에 자동 저장한다", () => {
    const store = new MemoryInstanceStore();
    const engine = new FlowEngine({ instanceStore: store });
    engine.registerSchema(createApprovalSchema());

    const inst = engine.startFlow("feature-approval", { team: "payments" });
    engine.selectBranch(inst.id, "high");
    engine.selectBranch(inst.id, "p1");

    expect(store.findBySchema("feature-approval")).toHaveLength(0);

    const result = engine.selectBranch(inst.id, "director");
    const stored = store.findBySchema("feature-approval");

    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      id: result.id,
      status: "completed",
      schemaId: "feature-approval",
    });
  });

  it("완료 시 addressContext를 자동 생성해 인스턴스와 저장소에 남긴다", () => {
    const store = new MemoryInstanceStore();
    const engine = new FlowEngine({ instanceStore: store });
    const schema = getAnnotatedDesignFlow();
    engine.registerSchema(schema);

    const inst = engine.startFlow("coordinate-design", { scopeMode: "hold" });
    engine.selectBranch(inst.id, "new-axis");
    engine.selectBranch(inst.id, "new-prefix");
    engine.selectBranch(inst.id, "minimum");
    engine.selectBranch(inst.id, "in-place");
    engine.selectBranch(inst.id, "keep-separate");
    const result = engine.selectBranch(inst.id, "single-owner");

    expect(result.status).toBe("completed");
    expect(result.addressContext).toEqual({
      decision_path: expect.stringMatching(/^decision_path:v1:\d+$/),
      decision_event: expect.stringMatching(/^decision_event:v1:\d+$/),
    });

    const stored = store.findBySchema("coordinate-design");
    expect(stored).toHaveLength(1);
    expect(stored[0]?.addressContext).toEqual(result.addressContext);
  });
});

describe("MemoryInstanceStore", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("schemaId + context key 기준으로 인스턴스를 조회한다", () => {
    vi.useFakeTimers();
    const store = new MemoryInstanceStore();
    const engine = new FlowEngine({ instanceStore: store });
    engine.registerSchema(createApprovalSchema());
    engine.registerSchema(
      new FlowSchemaBuilder("incident-review", "장애 검토")
        .gate("severity", "심각도", "perceive", [
          { id: "sev1", label: "SEV1" },
          { id: "sev2", label: "SEV2" },
        ])
        .build(),
    );

    vi.setSystemTime(new Date("2026-03-24T09:00:00.000Z"));
    const approval = engine.startFlow("feature-approval", {
      team: { id: "payments" },
      env: "prod",
    });
    engine.selectBranch(approval.id, "high");
    engine.selectBranch(approval.id, "p1");
    engine.selectBranch(approval.id, "director");

    vi.setSystemTime(new Date("2026-03-24T10:00:00.000Z"));
    const incident = engine.startFlow("incident-review", {
      team: { id: "payments" },
    });
    engine.selectBranch(incident.id, "sev1");

    vi.setSystemTime(new Date("2026-03-24T11:00:00.000Z"));
    const otherApproval = engine.startFlow("feature-approval", {
      env: "staging",
    });
    engine.selectBranch(otherApproval.id, "low");
    engine.selectBranch(otherApproval.id, "p2");
    engine.selectBranch(otherApproval.id, "auto");

    expect(
      store.findByContext({ schemaId: "feature-approval", key: "team.id" }),
    ).toHaveLength(1);
    expect(
      store.findByContext({
        schemaId: "feature-approval",
        key: "env",
        value: "prod",
      }),
    ).toHaveLength(1);
    expect(store.findByContext({ key: "team.id" })).toHaveLength(2);
  });

  it("startedAt 기준 시간 범위 조회를 지원한다", () => {
    vi.useFakeTimers();
    const store = new MemoryInstanceStore();
    const engine = new FlowEngine({ instanceStore: store });
    engine.registerSchema(createApprovalSchema());

    vi.setSystemTime(new Date("2026-03-24T09:00:00.000Z"));
    const first = engine.startFlow("feature-approval", { run: 1 });
    engine.selectBranch(first.id, "low");
    engine.selectBranch(first.id, "p2");
    engine.selectBranch(first.id, "auto");

    vi.setSystemTime(new Date("2026-03-24T10:00:00.000Z"));
    const second = engine.startFlow("feature-approval", { run: 2 });
    engine.selectBranch(second.id, "medium");
    engine.selectBranch(second.id, "p1");
    engine.selectBranch(second.id, "lead");

    vi.setSystemTime(new Date("2026-03-24T11:00:00.000Z"));
    const third = engine.startFlow("feature-approval", { run: 3 });
    engine.selectBranch(third.id, "high");
    engine.selectBranch(third.id, "p0");
    engine.selectBranch(third.id, "director");

    const results = store.findByTimeRange({
      schemaId: "feature-approval",
      from: "2026-03-24T09:30:00.000Z",
      to: "2026-03-24T10:30:00.000Z",
    });

    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(second.id);
    expect(results[0].startedAt).toBe("2026-03-24T10:00:00.000Z");
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

describe("policy-learning", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("동일 컨텍스트 키와 동일 경로가 기본 5회 이상 반복되면 패턴으로 감지한다", () => {
    vi.useFakeTimers();
    const store = new MemoryInstanceStore();
    const engine = new FlowEngine({ instanceStore: store });
    engine.registerSchema(createApprovalSchema());

    const repeatedRuns = [
      { at: "2026-03-24T09:00:00.000Z", confidence: [0.9, 0.8, 0.7] },
      { at: "2026-03-24T10:00:00.000Z", confidence: [0.8, 0.9, 0.7] },
      { at: "2026-03-24T11:00:00.000Z", confidence: [0.9, 0.7, 0.8] },
      { at: "2026-03-24T12:00:00.000Z", confidence: [0.8, 0.8, 0.8] },
      { at: "2026-03-24T13:00:00.000Z", confidence: [0.7, 0.9, 0.8] },
    ];

    for (const run of repeatedRuns) {
      vi.setSystemTime(new Date(run.at));
      const instance = engine.startFlow("feature-approval", {
        team: { id: "payments" },
        env: "prod",
      });
      engine.selectBranch(instance.id, "high", [], { confidence: run.confidence[0] });
      engine.selectBranch(instance.id, "p1", [], { confidence: run.confidence[1] });
      engine.selectBranch(instance.id, "director", [], { confidence: run.confidence[2] });
    }

    const nonPatternRuns = [
      "2026-03-24T14:00:00.000Z",
      "2026-03-24T15:00:00.000Z",
      "2026-03-24T16:00:00.000Z",
      "2026-03-24T17:00:00.000Z",
    ];

    for (const at of nonPatternRuns) {
      vi.setSystemTime(new Date(at));
      const instance = engine.startFlow("feature-approval", {
        team: { id: "search" },
      });
      engine.selectBranch(instance.id, "low", [], { confidence: 0.9 });
      engine.selectBranch(instance.id, "p2", [], { confidence: 0.8 });
      engine.selectBranch(instance.id, "auto", [], { confidence: 0.9 });
    }

    const patterns = detectPatterns(store, "feature-approval", {
      contextKeys: ["team.id"],
    });

    expect(patterns).toHaveLength(1);
    expect(patterns[0]).toMatchObject({
      schemaId: "feature-approval",
      contextKey: "team.id",
      contextValue: "payments",
      frequency: 5,
      firstSeenAt: "2026-03-24T09:00:00.000Z",
      lastSeenAt: "2026-03-24T13:00:00.000Z",
    });
    expect(patterns[0].gatePath).toEqual([
      { gateId: "risk", branchId: "high" },
      { gateId: "priority", branchId: "p1" },
      { gateId: "approval", branchId: "director" },
    ]);
    expect(patterns[0].averageConfidence).toBeCloseTo(0.8, 6);
    expect(patterns[0].histogram).toEqual({
      approval: { director: 5 },
      priority: { p1: 5 },
      risk: { high: 5 },
    });
  });

  it("contextKeys가 없으면 중첩 컨텍스트 키를 자동 평탄화한다", () => {
    vi.useFakeTimers();
    const store = new MemoryInstanceStore();
    const engine = new FlowEngine({ instanceStore: store });
    engine.registerSchema(createApprovalSchema());

    for (const at of [
      "2026-03-24T09:00:00.000Z",
      "2026-03-24T10:00:00.000Z",
      "2026-03-24T11:00:00.000Z",
      "2026-03-24T12:00:00.000Z",
      "2026-03-24T13:00:00.000Z",
    ]) {
      vi.setSystemTime(new Date(at));
      const instance = engine.startFlow("feature-approval", {
        team: { id: "ml-platform" },
        env: "prod",
      });
      engine.selectBranch(instance.id, "medium", [], { confidence: 0.8 });
      engine.selectBranch(instance.id, "p0", [], { confidence: 0.8 });
      engine.selectBranch(instance.id, "lead", [], { confidence: 0.9 });
    }

    const patterns = detectPatterns(store, "feature-approval");

    expect(
      patterns.some((pattern) =>
        pattern.contextKey === "team.id"
        && pattern.contextValue === "ml-platform"
        && pattern.frequency === 5,
      ),
    ).toBe(true);
    expect(
      patterns.some((pattern) =>
        pattern.contextKey === "env"
        && pattern.contextValue === "prod"
        && pattern.frequency === 5,
      ),
    ).toBe(true);
  });

  it("감지된 패턴에서 policy candidate를 자동 생성한다", () => {
    vi.useFakeTimers();
    const store = new MemoryInstanceStore();
    const engine = new FlowEngine({ instanceStore: store });
    engine.registerSchema(createApprovalSchema());

    for (const [index, at] of [
      "2026-03-24T09:00:00.000Z",
      "2026-03-24T10:00:00.000Z",
      "2026-03-24T11:00:00.000Z",
      "2026-03-24T12:00:00.000Z",
      "2026-03-24T13:00:00.000Z",
    ].entries()) {
      vi.setSystemTime(new Date(at));
      const instance = engine.startFlow("feature-approval", {
        team: { id: "payments" },
      });
      engine.selectBranch(instance.id, "high", [], { confidence: 0.82 + (index * 0.01) });
      engine.selectBranch(instance.id, "p1", [], { confidence: 0.84 });
      engine.selectBranch(instance.id, "director", [], { confidence: 0.87 });
    }

    const patterns = detectPatterns(store, "feature-approval", {
      contextKeys: ["team.id"],
    });
    const candidates = generatePolicyCandidates(patterns, 5);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      flowId: "feature-approval",
      status: "candidate",
      rationale: "5회 반복, 평균 confidence 0.85",
      action: {
        gateId: "approval",
        branchId: "director",
      },
    });
    expect(candidates[0].conditions).toEqual([
      { field: "context.team.id", op: "eq", value: "payments" },
      { field: "gate.risk.branch", op: "eq", value: "high" },
      { field: "gate.priority.branch", op: "eq", value: "p1" },
    ]);
  });

  it("빈도와 평균 confidence 임계값을 만족하는 패턴만 후보로 생성한다", () => {
    const candidates = generatePolicyCandidates([
      {
        schemaId: "feature-approval",
        contextKey: "team.id",
        contextValue: "payments",
        gatePath: [
          { gateId: "risk", branchId: "high" },
          { gateId: "approval", branchId: "director" },
        ],
        frequency: 4,
        averageConfidence: 0.91,
        firstSeenAt: "2026-03-24T09:00:00.000Z",
        lastSeenAt: "2026-03-24T12:00:00.000Z",
        histogram: {
          risk: { high: 4 },
          approval: { director: 4 },
        },
      },
      {
        schemaId: "feature-approval",
        contextKey: "team.id",
        contextValue: "search",
        gatePath: [
          { gateId: "risk", branchId: "medium" },
          { gateId: "approval", branchId: "lead" },
        ],
        frequency: 5,
        averageConfidence: 0.79,
        firstSeenAt: "2026-03-24T09:00:00.000Z",
        lastSeenAt: "2026-03-24T13:00:00.000Z",
        histogram: {
          risk: { medium: 5 },
          approval: { lead: 5 },
        },
      },
    ], 5);

    expect(candidates).toHaveLength(0);
  });

  it("이미 등록된 정책과 동일한 조건/액션이면 후보 생성을 건너뛴다", () => {
    const candidates = generatePolicyCandidates([
      {
        schemaId: "feature-approval",
        contextKey: "team.id",
        contextValue: "payments",
        gatePath: [
          { gateId: "risk", branchId: "high" },
          { gateId: "priority", branchId: "p1" },
          { gateId: "approval", branchId: "director" },
        ],
        frequency: 5,
        averageConfidence: 0.84,
        firstSeenAt: "2026-03-24T09:00:00.000Z",
        lastSeenAt: "2026-03-24T13:00:00.000Z",
        histogram: {
          risk: { high: 5 },
          priority: { p1: 5 },
          approval: { director: 5 },
        },
      },
    ], {
      minFrequency: 5,
      existingPolicies: [
        {
          id: "existing-payments-director",
          name: "payments director escalation",
          flowId: "feature-approval",
          priority: 90,
          conditions: [
            { field: "gate.priority.branch", op: "eq", value: "p1" },
            { field: "context.team.id", op: "eq", value: "payments" },
            { field: "gate.risk.branch", op: "eq", value: "high" },
          ],
          action: { gateId: "approval", branchId: "director", confidence: 0.9 },
          rationale: "이미 등록된 정책",
        },
      ],
    });

    expect(candidates).toHaveLength(0);
  });

  it("approveCandidate가 FlowPolicy로 변환하고 엔진에 등록한다", () => {
    const engine = new FlowEngine();
    engine.registerSchema(createApprovalSchema());

    const workflow = new PolicyCandidateWorkflow({ engine });
    const [candidate] = workflow.proposeCandidates([
      {
        schemaId: "feature-approval",
        contextKey: "team.id",
        contextValue: "payments",
        gatePath: [
          { gateId: "risk", branchId: "high" },
          { gateId: "priority", branchId: "p1" },
          { gateId: "approval", branchId: "director" },
        ],
        frequency: 6,
        averageConfidence: 0.88,
        firstSeenAt: "2026-03-24T09:00:00.000Z",
        lastSeenAt: "2026-03-24T15:00:00.000Z",
        histogram: {
          risk: { high: 6 },
          priority: { p1: 6 },
          approval: { director: 6 },
        },
      },
    ], 5);

    const approved = workflow.approveCandidate(candidate.id);

    expect(approved).toMatchObject({
      id: candidate.id,
      flowId: "feature-approval",
      action: {
        gateId: "approval",
        branchId: "director",
      },
    });
    expect(workflow.getCandidate(candidate.id)).toMatchObject({
      id: candidate.id,
      status: "approved",
    });
    expect(engine.getPolicies("feature-approval")).toContainEqual(approved);
  });

  it("rejectCandidate가 동일 시그니처 재제안을 억제한다", () => {
    const workflow = new PolicyCandidateWorkflow();
    const patterns = [
      {
        schemaId: "feature-approval",
        contextKey: "team.id",
        contextValue: "payments",
        gatePath: [
          { gateId: "risk", branchId: "high" },
          { gateId: "priority", branchId: "p1" },
          { gateId: "approval", branchId: "director" },
        ],
        frequency: 5,
        averageConfidence: 0.84,
        firstSeenAt: "2026-03-24T09:00:00.000Z",
        lastSeenAt: "2026-03-24T13:00:00.000Z",
        histogram: {
          risk: { high: 5 },
          priority: { p1: 5 },
          approval: { director: 5 },
        },
      },
    ] as const;

    const [candidate] = workflow.proposeCandidates(patterns, 5);
    const rejected = workflow.rejectCandidate(candidate.id, "수동 검토가 필요하다");

    expect(rejected).toMatchObject({
      id: candidate.id,
      status: "rejected",
      reviewReason: "수동 검토가 필요하다",
    });
    expect(workflow.proposeCandidates(patterns, 5)).toHaveLength(0);
  });

  it("modifyCandidate가 조건과 분기를 수정한 뒤 승인 등록한다", () => {
    const engine = new FlowEngine();
    engine.registerSchema(createApprovalSchema());

    const workflow = new PolicyCandidateWorkflow({ engine });
    const [candidate] = workflow.proposeCandidates([
      {
        schemaId: "feature-approval",
        contextKey: "team.id",
        contextValue: "payments",
        gatePath: [
          { gateId: "risk", branchId: "medium" },
          { gateId: "priority", branchId: "p1" },
          { gateId: "approval", branchId: "lead" },
        ],
        frequency: 5,
        averageConfidence: 0.86,
        firstSeenAt: "2026-03-24T09:00:00.000Z",
        lastSeenAt: "2026-03-24T13:00:00.000Z",
        histogram: {
          risk: { medium: 5 },
          priority: { p1: 5 },
          approval: { lead: 5 },
        },
      },
    ], 5);

    const modified = workflow.modifyCandidate(candidate.id, {
      conditions: [
        { field: "context.team.id", op: "eq", value: "payments" },
        { field: "gate.risk.branch", op: "eq", value: "high" },
        { field: "gate.priority.branch", op: "eq", value: "p1" },
      ],
      action: {
        branchId: "director",
        confidence: 0.93,
      },
      rationale: "payments 팀의 high risk는 director 승인으로 조정",
    });

    expect(modified).toMatchObject({
      id: candidate.id,
      action: {
        gateId: "approval",
        branchId: "director",
        confidence: 0.93,
      },
      rationale: "payments 팀의 high risk는 director 승인으로 조정",
    });
    expect(workflow.getCandidate(candidate.id)).toMatchObject({
      id: candidate.id,
      status: "modified",
      action: {
        branchId: "director",
      },
    });
    expect(engine.getPolicies("feature-approval")).toContainEqual(modified);
  });
});

describe("comparison", () => {
  function createWeightedApprovalSchema(): FlowSchema {
    const schema = createApprovalSchema();
    return {
      ...schema,
      gates: schema.gates.map((gate) => {
        if (gate.id === "risk") {
          return { ...gate, weight: "core" as const };
        }
        if (gate.id === "priority") {
          return { ...gate, weight: "structural" as const };
        }
        return { ...gate, weight: "tactical" as const };
      }),
    };
  }

  function createCompletedInstance(
    id: string,
    schemaId: string,
    selections: FlowInstance["selections"],
  ): FlowInstance {
    return {
      id,
      schemaId,
      schemaVersion: "v1",
      status: "completed",
      context: {},
      selections,
      startedAt: "2026-03-24T09:00:00.000Z",
      completedAt: "2026-03-24T09:10:00.000Z",
      coordinateAddress: 0,
    };
  }

  function createTimedCompletedInstance(
    id: string,
    schemaId: string,
    startedAt: string,
    selections: FlowInstance["selections"],
  ): FlowInstance {
    return {
      ...createCompletedInstance(id, schemaId, selections),
      startedAt,
      completedAt: new Date(new Date(startedAt).getTime() + 10 * 60 * 1000).toISOString(),
    };
  }

  it("gate별 match/diverge와 첫 divergence point, core divergence를 식별한다", () => {
    const schema = createWeightedApprovalSchema();
    const instanceA = createCompletedInstance("run-a", schema.id, [
      {
        gateId: "risk",
        branchId: "high",
        evidence: [
          { kind: "data", source: "scan", content: "외부 API 호출 3건", weight: 0.9 },
        ],
        confidence: 0.9,
        timestamp: "2026-03-24T09:01:00.000Z",
        durationMs: 1000,
      },
      {
        gateId: "priority",
        branchId: "p1",
        evidence: [
          { kind: "rule", source: "policy", content: "보안 변경은 P1 이상", weight: 0.8 },
        ],
        confidence: 0.8,
        timestamp: "2026-03-24T09:02:00.000Z",
        durationMs: 800,
      },
      {
        gateId: "approval",
        branchId: "director",
        evidence: [
          { kind: "external", source: "ceo", content: "임원 승인 요청", weight: 0.7 },
        ],
        confidence: 0.75,
        timestamp: "2026-03-24T09:03:00.000Z",
        durationMs: 900,
      },
    ]);
    const instanceB = createCompletedInstance("run-b", schema.id, [
      {
        gateId: "risk",
        branchId: "medium",
        evidence: [
          { kind: "precedent", source: "incident", content: "유사 변경 1회", weight: 0.6 },
        ],
        confidence: 0.7,
        timestamp: "2026-03-24T09:01:30.000Z",
        durationMs: 1200,
      },
      {
        gateId: "priority",
        branchId: "p1",
        evidence: [
          { kind: "rule", source: "policy", content: "보안 변경은 P1 이상", weight: 0.8 },
        ],
        confidence: 0.8,
        timestamp: "2026-03-24T09:02:30.000Z",
        durationMs: 700,
      },
      {
        gateId: "approval",
        branchId: "lead",
        evidence: [
          { kind: "external", source: "slack", content: "팀 리드 승인으로 충분", weight: 0.5 },
        ],
        confidence: 0.6,
        timestamp: "2026-03-24T09:03:30.000Z",
        durationMs: 600,
      },
    ]);

    const diff = diffInstances(instanceA, instanceB, schema);

    expect(diff.gateDiffs.map((gateDiff) => [gateDiff.gateId, gateDiff.status])).toEqual([
      ["risk", "diverge"],
      ["priority", "match"],
      ["approval", "diverge"],
    ]);
    expect(diff.divergencePoint?.gateId).toBe("risk");
    expect(diff.divergencePoint?.weight).toBe("core");
    expect(diff.divergencePoint?.emphasis).toBe("core");
    expect(diff.coreDivergences.map((gateDiff) => gateDiff.gateId)).toEqual(["risk"]);
    expect(diff.matchCount).toBe(1);
    expect(diff.divergenceCount).toBe(2);
    expect(diff.gateDiffs[0].evidenceDiff).toMatchObject({
      hasDifference: true,
      totalWeightA: 0.9,
      totalWeightB: 0.6,
      weightDelta: 0.3,
      kindHistogramA: { data: 1 },
      kindHistogramB: { precedent: 1 },
    });
    expect(diff.gateDiffs[0].evidenceDiff.onlyInA).toEqual([
      { kind: "data", source: "scan", content: "외부 API 호출 3건", weight: 0.9 },
    ]);
    expect(diff.gateDiffs[0].evidenceDiff.onlyInB).toEqual([
      { kind: "precedent", source: "incident", content: "유사 변경 1회", weight: 0.6 },
    ]);
    expect(diff.gateDiffs[1].evidenceDiff).toMatchObject({
      hasDifference: false,
      shared: [
        { kind: "rule", source: "policy", content: "보안 변경은 P1 이상", weight: 0.8 },
      ],
    });
  });

  it("schema 없이도 두 인스턴스의 선택 순서를 합쳐 첫 divergence를 찾는다", () => {
    const instanceA = createCompletedInstance("run-a", "feature-approval", [
      {
        gateId: "risk",
        branchId: "low",
        evidence: [],
        confidence: 0.9,
        timestamp: "2026-03-24T09:01:00.000Z",
        durationMs: 1000,
      },
      {
        gateId: "approval",
        branchId: "auto",
        evidence: [],
        confidence: 0.95,
        timestamp: "2026-03-24T09:02:00.000Z",
        durationMs: 500,
      },
    ]);
    const instanceB = createCompletedInstance("run-b", "feature-approval", [
      {
        gateId: "risk",
        branchId: "low",
        evidence: [],
        confidence: 0.8,
        timestamp: "2026-03-24T09:01:30.000Z",
        durationMs: 800,
      },
      {
        gateId: "priority",
        branchId: "p2",
        evidence: [],
        confidence: 0.8,
        timestamp: "2026-03-24T09:02:30.000Z",
        durationMs: 600,
      },
      {
        gateId: "approval",
        branchId: "auto",
        evidence: [],
        confidence: 0.9,
        timestamp: "2026-03-24T09:03:00.000Z",
        durationMs: 400,
      },
    ]);

    const diff = diffInstances(instanceA, instanceB);

    expect(diff.gateDiffs.map((gateDiff) => gateDiff.gateId)).toEqual([
      "risk",
      "priority",
      "approval",
    ]);
    expect(diff.divergencePoint?.gateId).toBe("priority");
    expect(diff.gateDiffs[1]).toMatchObject({
      status: "diverge",
      branchA: undefined,
      branchB: "p2",
    });
    expect(diff.gateDiffs[2]).toMatchObject({
      status: "match",
      branchA: "auto",
      branchB: "auto",
    });
  });

  it("gate별 branch 분포와 지배 branch, evidence kind 상관을 계산한다", () => {
    const store = new MemoryInstanceStore();

    const instances = [
      createCompletedInstance("run-1", "feature-approval", [
        {
          gateId: "risk",
          branchId: "high",
          evidence: [
            { kind: "data", source: "scan", content: "취약점 3건", weight: 0.9 },
            { kind: "rule", source: "policy", content: "외부 노출이면 high", weight: 0.7 },
          ],
          confidence: 0.9,
          timestamp: "2026-03-24T09:01:00.000Z",
          durationMs: 800,
        },
      ]),
      createCompletedInstance("run-2", "feature-approval", [
        {
          gateId: "risk",
          branchId: "high",
          evidence: [
            { kind: "data", source: "scan", content: "외부 API 변경", weight: 0.8 },
          ],
          confidence: 0.8,
          timestamp: "2026-03-24T09:02:00.000Z",
          durationMs: 700,
        },
      ]),
      createCompletedInstance("run-3", "feature-approval", [
        {
          gateId: "risk",
          branchId: "high",
          evidence: [
            { kind: "data", source: "scan", content: "권한 변경", weight: 0.75 },
            { kind: "external", source: "security", content: "보안팀 확인", weight: 0.6 },
          ],
          confidence: 0.85,
          timestamp: "2026-03-24T09:03:00.000Z",
          durationMs: 650,
        },
      ]),
      createCompletedInstance("run-4", "feature-approval", [
        {
          gateId: "risk",
          branchId: "high",
          evidence: [
            { kind: "rule", source: "policy", content: "고객 데이터 접근", weight: 0.8 },
          ],
          confidence: 0.95,
          timestamp: "2026-03-24T09:04:00.000Z",
          durationMs: 900,
        },
      ]),
      createCompletedInstance("run-5", "feature-approval", [
        {
          gateId: "risk",
          branchId: "low",
          evidence: [
            { kind: "precedent", source: "history", content: "유사 변경 무사고", weight: 0.6 },
          ],
          confidence: 0.6,
          timestamp: "2026-03-24T09:05:00.000Z",
          durationMs: 500,
        },
      ]),
    ];

    for (const instance of instances) {
      store.save(instance);
    }

    const distribution = gateDistribution(store, "feature-approval", "risk");

    expect(distribution.totalSelections).toBe(5);
    expect(distribution.branches).toEqual([
      {
        branchId: "high",
        count: 4,
        ratio: 0.8,
        averageConfidence: 0.875,
        isDominant: true,
      },
      {
        branchId: "low",
        count: 1,
        ratio: 0.2,
        averageConfidence: 0.6,
        isDominant: false,
      },
    ]);
    expect(distribution.dominantBranch).toMatchObject({
      branchId: "high",
      count: 4,
      ratio: 0.8,
      averageConfidence: 0.875,
    });
    expect(distribution.dominantBranch?.hint).toContain("\"high\"");
    expect(distribution.evidenceKindCorrelations).toEqual([
      {
        evidenceKind: "data",
        selectionCount: 3,
        selectionRatio: 0.6,
        branches: [
          {
            branchId: "high",
            count: 3,
            ratio: 1,
            averageConfidence: 0.85,
          },
        ],
        dominantBranchId: "high",
      },
      {
        evidenceKind: "rule",
        selectionCount: 2,
        selectionRatio: 0.4,
        branches: [
          {
            branchId: "high",
            count: 2,
            ratio: 1,
            averageConfidence: 0.925,
          },
        ],
        dominantBranchId: "high",
      },
      {
        evidenceKind: "external",
        selectionCount: 1,
        selectionRatio: 0.2,
        branches: [
          {
            branchId: "high",
            count: 1,
            ratio: 1,
            averageConfidence: 0.85,
          },
        ],
        dominantBranchId: "high",
      },
      {
        evidenceKind: "precedent",
        selectionCount: 1,
        selectionRatio: 0.2,
        branches: [
          {
            branchId: "low",
            count: 1,
            ratio: 1,
            averageConfidence: 0.6,
          },
        ],
        dominantBranchId: "low",
      },
    ]);
  });

  it("완료 인스턴스에 gate 선택이 없으면 빈 분포를 반환한다", () => {
    const store = new MemoryInstanceStore();

    store.save({
      id: "run-pending",
      schemaId: "feature-approval",
      schemaVersion: "v1",
      status: "pending",
      context: {},
      selections: [],
      startedAt: "2026-03-24T09:00:00.000Z",
    });
    store.save(createCompletedInstance("run-approval", "feature-approval", [
      {
        gateId: "approval",
        branchId: "auto",
        evidence: [],
        confidence: 0.9,
        timestamp: "2026-03-24T09:10:00.000Z",
        durationMs: 300,
      },
    ]));

    expect(gateDistribution(store, "feature-approval", "risk")).toEqual({
      schemaId: "feature-approval",
      gateId: "risk",
      totalSelections: 0,
      branches: [],
      dominantBranch: undefined,
      evidenceKindCorrelations: [],
    });
  });

  it("시간 범위별 gate 분포 변화율과 등장/소멸 경로를 계산한다", () => {
    const schema = createWeightedApprovalSchema();
    const store = new MemoryInstanceStore();

    [
      createTimedCompletedInstance("range-a-1", schema.id, "2026-03-20T09:00:00.000Z", [
        {
          gateId: "risk",
          branchId: "low",
          evidence: [],
          confidence: 0.8,
          timestamp: "2026-03-20T09:01:00.000Z",
          durationMs: 500,
        },
        {
          gateId: "priority",
          branchId: "p2",
          evidence: [],
          confidence: 0.8,
          timestamp: "2026-03-20T09:02:00.000Z",
          durationMs: 400,
        },
        {
          gateId: "approval",
          branchId: "auto",
          evidence: [],
          confidence: 0.9,
          timestamp: "2026-03-20T09:03:00.000Z",
          durationMs: 300,
        },
      ]),
      createTimedCompletedInstance("range-a-2", schema.id, "2026-03-20T10:00:00.000Z", [
        {
          gateId: "risk",
          branchId: "low",
          evidence: [],
          confidence: 0.75,
          timestamp: "2026-03-20T10:01:00.000Z",
          durationMs: 450,
        },
        {
          gateId: "priority",
          branchId: "p2",
          evidence: [],
          confidence: 0.78,
          timestamp: "2026-03-20T10:02:00.000Z",
          durationMs: 350,
        },
        {
          gateId: "approval",
          branchId: "auto",
          evidence: [],
          confidence: 0.88,
          timestamp: "2026-03-20T10:03:00.000Z",
          durationMs: 280,
        },
      ]),
      createTimedCompletedInstance("range-b-1", schema.id, "2026-03-24T09:00:00.000Z", [
        {
          gateId: "risk",
          branchId: "high",
          evidence: [],
          confidence: 0.92,
          timestamp: "2026-03-24T09:01:00.000Z",
          durationMs: 520,
        },
        {
          gateId: "priority",
          branchId: "p1",
          evidence: [],
          confidence: 0.9,
          timestamp: "2026-03-24T09:02:00.000Z",
          durationMs: 410,
        },
        {
          gateId: "approval",
          branchId: "director",
          evidence: [],
          confidence: 0.91,
          timestamp: "2026-03-24T09:03:00.000Z",
          durationMs: 390,
        },
      ]),
      createTimedCompletedInstance("range-b-2", schema.id, "2026-03-24T10:00:00.000Z", [
        {
          gateId: "risk",
          branchId: "medium",
          evidence: [],
          confidence: 0.74,
          timestamp: "2026-03-24T10:01:00.000Z",
          durationMs: 510,
        },
        {
          gateId: "priority",
          branchId: "p1",
          evidence: [],
          confidence: 0.77,
          timestamp: "2026-03-24T10:02:00.000Z",
          durationMs: 420,
        },
        {
          gateId: "approval",
          branchId: "lead",
          evidence: [],
          confidence: 0.73,
          timestamp: "2026-03-24T10:03:00.000Z",
          durationMs: 360,
        },
      ]),
    ].forEach((instance) => store.save(instance));

    const comparison = compareTimeRanges(
      store,
      schema.id,
      {
        from: "2026-03-20T00:00:00.000Z",
        to: "2026-03-20T23:59:59.999Z",
      },
      {
        from: "2026-03-24T00:00:00.000Z",
        to: "2026-03-24T23:59:59.999Z",
      },
      { schema },
    );

    expect(comparison.comparedGateIds).toEqual(["risk", "priority", "approval"]);
    expect(comparison.rangeA.instanceCount).toBe(2);
    expect(comparison.rangeB.instanceCount).toBe(2);
    expect(comparison.gateShifts).toEqual([
      {
        gateId: "risk",
        gateName: "위험도 평가",
        phase: "perceive",
        weight: "core",
        totalSelectionsA: 2,
        totalSelectionsB: 2,
        totalShiftPercentage: 100,
        dominantBranchA: "low",
        dominantBranchB: "high",
        branches: [
          {
            branchId: "low",
            countA: 2,
            countB: 0,
            ratioA: 1,
            ratioB: 0,
            deltaRatio: -1,
            shiftPercentage: 100,
          },
          {
            branchId: "high",
            countA: 0,
            countB: 1,
            ratioA: 0,
            ratioB: 0.5,
            deltaRatio: 0.5,
            shiftPercentage: 50,
          },
          {
            branchId: "medium",
            countA: 0,
            countB: 1,
            ratioA: 0,
            ratioB: 0.5,
            deltaRatio: 0.5,
            shiftPercentage: 50,
          },
        ],
      },
      {
        gateId: "priority",
        gateName: "우선순위",
        phase: "evaluate",
        weight: "structural",
        totalSelectionsA: 2,
        totalSelectionsB: 2,
        totalShiftPercentage: 100,
        dominantBranchA: "p2",
        dominantBranchB: "p1",
        branches: [
          {
            branchId: "p1",
            countA: 0,
            countB: 2,
            ratioA: 0,
            ratioB: 1,
            deltaRatio: 1,
            shiftPercentage: 100,
          },
          {
            branchId: "p2",
            countA: 2,
            countB: 0,
            ratioA: 1,
            ratioB: 0,
            deltaRatio: -1,
            shiftPercentage: 100,
          },
        ],
      },
      {
        gateId: "approval",
        gateName: "승인 레벨",
        phase: "decide",
        weight: "tactical",
        totalSelectionsA: 2,
        totalSelectionsB: 2,
        totalShiftPercentage: 100,
        dominantBranchA: "auto",
        dominantBranchB: "director",
        branches: [
          {
            branchId: "auto",
            countA: 2,
            countB: 0,
            ratioA: 1,
            ratioB: 0,
            deltaRatio: -1,
            shiftPercentage: 100,
          },
          {
            branchId: "director",
            countA: 0,
            countB: 1,
            ratioA: 0,
            ratioB: 0.5,
            deltaRatio: 0.5,
            shiftPercentage: 50,
          },
          {
            branchId: "lead",
            countA: 0,
            countB: 1,
            ratioA: 0,
            ratioB: 0.5,
            deltaRatio: 0.5,
            shiftPercentage: 50,
          },
        ],
      },
    ]);
    expect(comparison.emergedPaths).toEqual([
      {
        signature: "risk:high|priority:p1|approval:director",
        path: [
          { gateId: "risk", branchId: "high" },
          { gateId: "priority", branchId: "p1" },
          { gateId: "approval", branchId: "director" },
        ],
        countA: 0,
        countB: 1,
      },
      {
        signature: "risk:medium|priority:p1|approval:lead",
        path: [
          { gateId: "risk", branchId: "medium" },
          { gateId: "priority", branchId: "p1" },
          { gateId: "approval", branchId: "lead" },
        ],
        countA: 0,
        countB: 1,
      },
    ]);
    expect(comparison.disappearedPaths).toEqual([
      {
        signature: "risk:low|priority:p2|approval:auto",
        path: [
          { gateId: "risk", branchId: "low" },
          { gateId: "priority", branchId: "p2" },
          { gateId: "approval", branchId: "auto" },
        ],
        countA: 2,
        countB: 0,
      },
    ]);
  });

  it("coreOnly 옵션으로 코어 gate 변화만 필터링한다", () => {
    const schema = createWeightedApprovalSchema();
    const store = new MemoryInstanceStore();

    [
      createTimedCompletedInstance("core-a-1", schema.id, "2026-03-20T09:00:00.000Z", [
        {
          gateId: "risk",
          branchId: "low",
          evidence: [],
          confidence: 0.8,
          timestamp: "2026-03-20T09:01:00.000Z",
          durationMs: 500,
        },
        {
          gateId: "priority",
          branchId: "p2",
          evidence: [],
          confidence: 0.8,
          timestamp: "2026-03-20T09:02:00.000Z",
          durationMs: 400,
        },
      ]),
      createTimedCompletedInstance("core-a-2", schema.id, "2026-03-20T10:00:00.000Z", [
        {
          gateId: "risk",
          branchId: "low",
          evidence: [],
          confidence: 0.75,
          timestamp: "2026-03-20T10:01:00.000Z",
          durationMs: 450,
        },
        {
          gateId: "priority",
          branchId: "p1",
          evidence: [],
          confidence: 0.78,
          timestamp: "2026-03-20T10:02:00.000Z",
          durationMs: 350,
        },
      ]),
      createTimedCompletedInstance("core-b-1", schema.id, "2026-03-24T09:00:00.000Z", [
        {
          gateId: "risk",
          branchId: "high",
          evidence: [],
          confidence: 0.92,
          timestamp: "2026-03-24T09:01:00.000Z",
          durationMs: 520,
        },
        {
          gateId: "priority",
          branchId: "p2",
          evidence: [],
          confidence: 0.9,
          timestamp: "2026-03-24T09:02:00.000Z",
          durationMs: 410,
        },
      ]),
      createTimedCompletedInstance("core-b-2", schema.id, "2026-03-24T10:00:00.000Z", [
        {
          gateId: "risk",
          branchId: "medium",
          evidence: [],
          confidence: 0.74,
          timestamp: "2026-03-24T10:01:00.000Z",
          durationMs: 510,
        },
        {
          gateId: "priority",
          branchId: "p1",
          evidence: [],
          confidence: 0.77,
          timestamp: "2026-03-24T10:02:00.000Z",
          durationMs: 420,
        },
      ]),
    ].forEach((instance) => store.save(instance));

    const comparison = compareTimeRanges(
      store,
      schema.id,
      {
        from: "2026-03-20T00:00:00.000Z",
        to: "2026-03-20T23:59:59.999Z",
      },
      {
        from: "2026-03-24T00:00:00.000Z",
        to: "2026-03-24T23:59:59.999Z",
      },
      { schema, coreOnly: true },
    );

    expect(comparison.comparedGateIds).toEqual(["risk"]);
    expect(comparison.coreGateIds).toEqual(["risk"]);
    expect(comparison.gateShifts).toHaveLength(1);
    expect(comparison.emergedPaths).toEqual([
      {
        signature: "risk:high",
        path: [{ gateId: "risk", branchId: "high" }],
        countA: 0,
        countB: 1,
      },
      {
        signature: "risk:medium",
        path: [{ gateId: "risk", branchId: "medium" }],
        countA: 0,
        countB: 1,
      },
    ]);
    expect(comparison.disappearedPaths).toEqual([
      {
        signature: "risk:low",
        path: [{ gateId: "risk", branchId: "low" }],
        countA: 2,
        countB: 0,
      },
    ]);
  });

  it("시간 범위별 완료 인스턴스가 2건 미만이면 에러를 던진다", () => {
    const store = new MemoryInstanceStore();

    store.save(createTimedCompletedInstance(
      "range-a-only",
      "feature-approval",
      "2026-03-20T09:00:00.000Z",
      [
        {
          gateId: "risk",
          branchId: "low",
          evidence: [],
          confidence: 0.8,
          timestamp: "2026-03-20T09:01:00.000Z",
          durationMs: 500,
        },
      ],
    ));
    store.save(createTimedCompletedInstance(
      "range-b-1",
      "feature-approval",
      "2026-03-24T09:00:00.000Z",
      [
        {
          gateId: "risk",
          branchId: "high",
          evidence: [],
          confidence: 0.9,
          timestamp: "2026-03-24T09:01:00.000Z",
          durationMs: 500,
        },
      ],
    ));
    store.save(createTimedCompletedInstance(
      "range-b-2",
      "feature-approval",
      "2026-03-24T10:00:00.000Z",
      [
        {
          gateId: "risk",
          branchId: "medium",
          evidence: [],
          confidence: 0.7,
          timestamp: "2026-03-24T10:01:00.000Z",
          durationMs: 500,
        },
      ],
    ));

    expect(() =>
      compareTimeRanges(
        store,
        "feature-approval",
        {
          from: "2026-03-20T00:00:00.000Z",
          to: "2026-03-20T23:59:59.999Z",
        },
        {
          from: "2026-03-24T00:00:00.000Z",
          to: "2026-03-24T23:59:59.999Z",
        },
      ),
    ).toThrow("rangeA 비교에는 완료 인스턴스가 최소 2건 필요하다");
  });

  it("pairwise diff, 분포, 시간 변화를 ComparisonReport로 묶고 why-different 추론을 직렬화한다", () => {
    const schema = createWeightedApprovalSchema();
    const pairA = createCompletedInstance("pair-a", schema.id, [
      {
        gateId: "risk",
        branchId: "high",
        evidence: [
          { kind: "data", source: "scan", content: "외부 API 호출 3건", weight: 0.9 },
        ],
        confidence: 0.9,
        timestamp: "2026-03-24T09:01:00.000Z",
        durationMs: 1000,
      },
      {
        gateId: "priority",
        branchId: "p1",
        evidence: [
          { kind: "rule", source: "policy", content: "보안 변경은 P1 이상", weight: 0.8 },
        ],
        confidence: 0.8,
        timestamp: "2026-03-24T09:02:00.000Z",
        durationMs: 800,
      },
      {
        gateId: "approval",
        branchId: "director",
        evidence: [
          { kind: "external", source: "ceo", content: "임원 승인 요청", weight: 0.7 },
        ],
        confidence: 0.75,
        timestamp: "2026-03-24T09:03:00.000Z",
        durationMs: 900,
      },
    ]);
    const pairB = createCompletedInstance("pair-b", schema.id, [
      {
        gateId: "risk",
        branchId: "medium",
        evidence: [
          { kind: "precedent", source: "incident", content: "유사 변경 1회", weight: 0.6 },
        ],
        confidence: 0.7,
        timestamp: "2026-03-24T09:01:30.000Z",
        durationMs: 1200,
      },
      {
        gateId: "priority",
        branchId: "p1",
        evidence: [
          { kind: "rule", source: "policy", content: "보안 변경은 P1 이상", weight: 0.8 },
        ],
        confidence: 0.8,
        timestamp: "2026-03-24T09:02:30.000Z",
        durationMs: 700,
      },
      {
        gateId: "approval",
        branchId: "lead",
        evidence: [
          { kind: "external", source: "slack", content: "팀 리드 승인으로 충분", weight: 0.5 },
        ],
        confidence: 0.6,
        timestamp: "2026-03-24T09:03:30.000Z",
        durationMs: 600,
      },
    ]);
    const store = new MemoryInstanceStore();

    [
      createTimedCompletedInstance("range-a-1", schema.id, "2026-03-20T09:00:00.000Z", [
        {
          gateId: "risk",
          branchId: "low",
          evidence: [
            { kind: "precedent", source: "history", content: "유사 변경 무사고", weight: 0.6 },
          ],
          confidence: 0.8,
          timestamp: "2026-03-20T09:01:00.000Z",
          durationMs: 500,
        },
      ]),
      createTimedCompletedInstance("range-a-2", schema.id, "2026-03-20T10:00:00.000Z", [
        {
          gateId: "risk",
          branchId: "low",
          evidence: [
            { kind: "precedent", source: "history", content: "유사 변경 무사고", weight: 0.6 },
          ],
          confidence: 0.75,
          timestamp: "2026-03-20T10:01:00.000Z",
          durationMs: 450,
        },
      ]),
      createTimedCompletedInstance("range-b-1", schema.id, "2026-03-24T09:00:00.000Z", [
        {
          gateId: "risk",
          branchId: "high",
          evidence: [
            { kind: "data", source: "scan", content: "취약점 3건", weight: 0.9 },
          ],
          confidence: 0.92,
          timestamp: "2026-03-24T09:01:00.000Z",
          durationMs: 520,
        },
      ]),
      createTimedCompletedInstance("range-b-2", schema.id, "2026-03-24T10:00:00.000Z", [
        {
          gateId: "risk",
          branchId: "high",
          evidence: [
            { kind: "data", source: "scan", content: "외부 API 변경", weight: 0.8 },
          ],
          confidence: 0.88,
          timestamp: "2026-03-24T10:01:00.000Z",
          durationMs: 510,
        },
      ]),
      createTimedCompletedInstance("range-b-3", schema.id, "2026-03-24T11:00:00.000Z", [
        {
          gateId: "risk",
          branchId: "high",
          evidence: [
            { kind: "rule", source: "policy", content: "고객 데이터 접근", weight: 0.7 },
          ],
          confidence: 0.9,
          timestamp: "2026-03-24T11:01:00.000Z",
          durationMs: 490,
        },
      ]),
    ].forEach((instance) => store.save(instance));

    const report = createComparisonReport({
      pairwiseDiff: diffInstances(pairA, pairB, schema),
      distributions: [
        gateDistribution(store, schema.id, "risk"),
      ],
      temporalShifts: [
        compareTimeRanges(
          store,
          schema.id,
          {
            from: "2026-03-20T00:00:00.000Z",
            to: "2026-03-20T23:59:59.999Z",
          },
          {
            from: "2026-03-24T00:00:00.000Z",
            to: "2026-03-24T23:59:59.999Z",
          },
          { schema, coreOnly: true },
        ),
      ],
    });

    expect(report.schemaId).toBe(schema.id);
    expect(report.whyDifferent).toEqual([
      {
        gateId: "risk",
        gateName: "위험도 평가",
        phase: "perceive",
        emphasis: "core",
        branchA: "high",
        branchB: "medium",
        reasonType: "exclusive-evidence",
        summary: "위험도 평가 gate는 A=\"high\", B=\"medium\"로 갈렸고 A는 data 근거(총 0.9), B는 precedent 근거(총 0.6)를 각각 별도로 사용했다.",
        evidenceSummary: {
          sharedKinds: [],
          uniqueKindsA: ["data"],
          uniqueKindsB: ["precedent"],
          uniqueWeightA: 0.9,
          uniqueWeightB: 0.6,
          confidenceA: 0.9,
          confidenceB: 0.7,
        },
      },
      {
        gateId: "approval",
        gateName: "승인 레벨",
        phase: "decide",
        emphasis: "standard",
        branchA: "director",
        branchB: "lead",
        reasonType: "exclusive-evidence",
        summary: "승인 레벨 gate는 A=\"director\", B=\"lead\"로 갈렸고 A는 external 근거(총 0.7), B는 external 근거(총 0.5)를 각각 별도로 사용했다.",
        evidenceSummary: {
          sharedKinds: [],
          uniqueKindsA: ["external"],
          uniqueKindsB: ["external"],
          uniqueWeightA: 0.7,
          uniqueWeightB: 0.5,
          confidenceA: 0.75,
          confidenceB: 0.6,
        },
      },
    ]);
    expect(report.distributionInsights).toEqual([
      {
        gateId: "risk",
        dominantBranchId: "high",
        sampleSize: 5,
        summary: "risk gate는 \"high\"가 가장 많지만 지배적이라고 보기엔 표본이 갈려 있다.",
      },
    ]);
    expect(report.temporalInsights).toEqual([
      {
        gateId: "risk",
        gateName: "위험도 평가",
        totalShiftPercentage: 100,
        dominantBranchA: "low",
        dominantBranchB: "high",
        summary: "위험도 평가 gate는 기간 A의 우세 branch \"low\"에서 기간 B의 우세 branch \"high\"로 이동했고 총 변화율은 100%다. 가장 큰 이동은 \"high\" (100%)였다.",
      },
    ]);
    expect(report.summary).toEqual({
      divergenceCount: 2,
      dominantDistributionCount: 0,
      temporalShiftCount: 1,
      highlights: [
        "위험도 평가 gate는 A=\"high\", B=\"medium\"로 갈렸고 A는 data 근거(총 0.9), B는 precedent 근거(총 0.6)를 각각 별도로 사용했다.",
        "승인 레벨 gate는 A=\"director\", B=\"lead\"로 갈렸고 A는 external 근거(총 0.7), B는 external 근거(총 0.5)를 각각 별도로 사용했다.",
        "risk gate는 \"high\"가 가장 많지만 지배적이라고 보기엔 표본이 갈려 있다.",
        "위험도 평가 gate는 기간 A의 우세 branch \"low\"에서 기간 B의 우세 branch \"high\"로 이동했고 총 변화율은 100%다. 가장 큰 이동은 \"high\" (100%)였다.",
      ],
    });

    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
  });
});
