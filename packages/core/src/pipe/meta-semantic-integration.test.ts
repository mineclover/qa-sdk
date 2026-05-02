// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * Meta-Semantic 통합 사용 시나리오
 *
 * 주문 처리 시스템을 meta-semantic 전체 체계로 구성하고 검증한다:
 * 1. DataSchema 정의 (패싯 역할 매핑)
 * 2. PipeGraph 구성 (파이프 + 연결)
 * 3. Constraint 정의 (스펙 → 증명)
 * 4. 시뮬레이션 실행
 * 5. 계보 추적
 * 6. 스키마 진화 + 호환 검증
 * 7. Constraint 실행 + 오류 추적
 * 8. 품질 지표 산출
 */

import { describe, it, expect } from "vitest";
import type {
  PipeSpec, PipeGraph, PipeFlow,
  DataSchema,
  FieldLineage,
} from "./index.js";
import {
  // 파이프
  countPipePaths, countGraphPaths,
  validatePipeSpec, validatePipeGraph,
  serializePipeGraph, deserializePipeGraph,
  MemoryPipeGraphStore,
  analyzePipeComplexity, findBottlenecks, analyzeCoverage,
  simulate,
  // 데이터 계약
  checkCompatibility, computeSchemaHash,
  collectSchemaChanges, createSchemaVersion,
  LineageCollector, VersionCollector,
  // constraint
  ConstraintRegistry, executeConstraint,
} from "./index.js";
import type { ConstraintDef } from "../types/constraint.js";

import { step } from "./__fixtures__/pipe-fixtures.js";

describe("통합 시나리오: 주문 처리 시스템", () => {
  // ── 1. 스키마 정의 ──────────────────────────────────

  const itemsSchema: DataSchema = {
    schemaId: "items", version: "v1",
    primaryKey: ["id"],
    schemaHash: "",
    columns: {
      id: { ref: { kind: "scalar", type: "string" }, facetRole: "identity", required: true },
      name: { ref: { kind: "scalar", type: "string" }, facetRole: "produced", required: true },
      price: { ref: { kind: "scalar", type: "number" }, facetRole: "produced", required: true },
      category: { ref: { kind: "axis_ref", axisId: "category" }, facetRole: "consumed", required: true },
    },
  };

  const ordersSchemaV1: DataSchema = {
    schemaId: "orders", version: "v1",
    primaryKey: ["id"],
    schemaHash: "",
    columns: {
      id: { ref: { kind: "scalar", type: "string" }, facetRole: "identity", required: true },
      member_id: { ref: { kind: "table_ref", table: "members" }, facetRole: "consumed", required: true },
      total_amount: { ref: { kind: "scalar", type: "number" }, facetRole: "derived", required: true },
      status: { ref: { kind: "axis_ref", axisId: "order_action" }, facetRole: "managed", required: true },
    },
  };

  // ── 2. PipeGraph 구성 ───────────────────────────────

  const orderPipe: PipeSpec = {
    pipeId: "order-process", version: "v1",
    trigger: { eventKey: "order_submitted" },
    flow: {
      kind: "sequence",
      steps: [
        step("소비", "order_submitted"),
        { kind: "step", facet: "관리", constraints: [{ field: "amount", op: "gt", value: 0 }] },
        { kind: "branch", condition: "inventory", paths: [
          step("생산", "order_confirmed"),
          step("생산", "order_waitlisted"),
        ]},
        step("저장"),
      ],
    },
    produces: ["order_confirmed", "order_waitlisted"],
    scope: "feature", aspect: "func_def",
  };

  const paymentPipe: PipeSpec = {
    pipeId: "payment-process", version: "v1",
    trigger: { eventKey: "order_confirmed" },
    flow: {
      kind: "finally",
      body: {
        kind: "retry",
        maxAttempts: 3, backoff: 1000,
        step: {
          kind: "fallback",
          try: step("관리", "pg_charge"),
          catch: step("관리", "pg_fallback"),
        },
      },
      cleanup: step("저장", "payment_log"),
    },
    produces: ["payment_completed"],
    scope: "feature", aspect: "func_def",
  };

  const notifyPipe: PipeSpec = {
    pipeId: "notify", version: "v1",
    trigger: { eventKey: "payment_completed" },
    flow: {
      kind: "tap",
      observe: step("관리", "log_notification"),
      step: { kind: "emit", eventKey: "notification_sent" },
    },
    produces: ["notification_sent"],
  };

  const orderSystem: PipeGraph = {
    graphId: "order-system", version: "v1",
    pipes: [orderPipe, paymentPipe, notifyPipe],
    connections: [
      { from: "order-process", to: "payment-process", kind: "event" },
      { from: "payment-process", to: "notify", kind: "event" },
    ],
    entryPipeId: "order-process",
    manifestVersion: "v1",
  };

  // ── 테스트 ──────────────────────────────────────────

  it("1. 스키마 해시 + 패싯 역할 확인", () => {
    const hash = computeSchemaHash(ordersSchemaV1);
    expect(hash).toBeTruthy();

    // 패싯 역할 분포
    const roles = Object.values(ordersSchemaV1.columns).map(c => c.facetRole);
    expect(roles).toContain("identity");
    expect(roles).toContain("consumed");
    expect(roles).toContain("derived");
    expect(roles).toContain("managed");
  });

  it("2. PipeGraph 검증 + 경로 수", () => {
    const specIssues = orderSystem.pipes.flatMap(p => validatePipeSpec(p));
    const graphIssues = validatePipeGraph(orderSystem);

    expect(specIssues.filter(i => i.severity === "error")).toHaveLength(0);
    expect(graphIssues.filter(i => i.severity === "error")).toHaveLength(0);

    // 경로 수
    expect(countPipePaths(orderPipe.flow)).toBe(2);    // branch: 확정/대기
    expect(countPipePaths(paymentPipe.flow)).toBe(2);   // fallback: try/catch
    expect(countGraphPaths(orderSystem)).toBeGreaterThanOrEqual(2);
  });

  it("3. 직렬화 라운드트립", () => {
    const json = serializePipeGraph(orderSystem);
    const restored = deserializePipeGraph(json);
    expect(restored.graphId).toBe("order-system");
    expect(restored.pipes).toHaveLength(3);
  });

  it("4. 저장소 CRUD", () => {
    const store = new MemoryPipeGraphStore();
    store.save(orderSystem);

    expect(store.get("order-system", "v1")).not.toBeNull();
    expect(store.findByPipeId("payment-process")).toHaveLength(1);
    expect(store.findByTriggerEvent("order_submitted")).toHaveLength(1);
  });

  it("5. 복잡도 분석 + 병목 감지", () => {
    const complexity = analyzePipeComplexity(orderSystem);
    expect(complexity.pipeCount).toBe(3);
    expect(complexity.connectionCount).toBe(2);
    expect(complexity.usedFlowKinds).toContain("branch");
    expect(complexity.usedFlowKinds).toContain("retry");
    expect(complexity.usedFlowKinds).toContain("fallback");

    const bottlenecks = findBottlenecks(orderSystem);
    expect(bottlenecks.failurePoints.length).toBeGreaterThan(0);
    expect(bottlenecks.failurePoints[0].pipeId).toBe("payment-process");
  });

  it("6. 시뮬레이션 — 정상 경로", () => {
    const result = simulate({
      graph: orderSystem,
      initialEvent: { eventKey: "order_submitted" },
      branchResolver: () => 0,  // 재고 있음 → order_confirmed
    });

    expect(result.status).toBe("complete");
    expect(result.pipeTrace).toContain("order-process");
    expect(result.pipeTrace).toContain("payment-process");
    expect(result.pipeTrace).toContain("notify");
    expect(result.facetTrace).toContain("소비");
    expect(result.facetTrace).toContain("관리");
    expect(result.facetTrace).toContain("저장");
    expect(result.producedEvents.map(e => e.eventKey)).toContain("notification_sent");
  });

  it("7. 시뮬레이션 — 대기 경로", () => {
    const result = simulate({
      graph: orderSystem,
      initialEvent: { eventKey: "order_submitted" },
      branchResolver: () => 1,  // 재고 없음 → order_waitlisted
    });

    expect(result.status).toBe("complete");
    // waitlisted는 payment를 트리거하지 않음 (order_confirmed만 트리거)
    expect(result.pipeTrace).toContain("order-process");
  });

  it("8. 커버리지 분석", () => {
    const coverage = analyzeCoverage(
      orderSystem,
      new Set(["order-process", "payment-process"]),
    );
    expect(coverage.pipeCoverage).toBe(67); // 2/3
    expect(coverage.uncoveredPipes).toEqual(["notify"]);
  });

  it("9. 계보 추적 — items.price → orders.total_amount", () => {
    const lineage = new LineageCollector();

    lineage.record({
      target: { schemaId: "orders", column: "total_amount" },
      sources: [{ schemaId: "items", column: "price" }],
      transform: "aggregate",
      pipeId: "order-process",
      stepPath: "flow.steps[2]",
    });

    lineage.record({
      target: { schemaId: "payments", column: "amount" },
      sources: [{ schemaId: "orders", column: "total_amount" }],
      transform: "direct",
      pipeId: "payment-process",
      stepPath: "flow.body.step.try",
    });

    // items.price 변경 영향
    const impact = lineage.traceImpact({ schemaId: "items", column: "price" });
    expect(impact).toHaveLength(2);
    expect(impact.map(l => l.target.schemaId)).toContain("orders");
    expect(impact.map(l => l.target.schemaId)).toContain("payments");

    // payments.amount 원본 추적
    const origins = lineage.traceOrigins({ schemaId: "payments", column: "amount" });
    expect(origins.flatMap(l => l.sources.map(s => s.schemaId))).toContain("items");
  });

  it("10. 스키마 진화 + 호환 검증", () => {
    const ordersV2: DataSchema = {
      ...ordersSchemaV1,
      version: "v2",
      columns: {
        ...ordersSchemaV1.columns,
        discount: { ref: { kind: "scalar", type: "number" }, facetRole: "derived", required: false },
      },
    };

    const ordersV3: DataSchema = {
      schemaId: "orders", version: "v3",
      primaryKey: ["id"],
      schemaHash: "",
      columns: {
        id: ordersSchemaV1.columns.id,
        total_amount: ordersSchemaV1.columns.total_amount,
        status: ordersSchemaV1.columns.status,
        discount: { ref: { kind: "scalar", type: "number" }, facetRole: "derived", required: false },
        // member_id 제거 → breaking
      },
    };

    const versions = new VersionCollector();
    versions.record(createSchemaVersion(ordersSchemaV1, ordersV2, "discount 추가"));
    versions.record(createSchemaVersion(ordersV2, ordersV3, "member_id 제거"));

    expect(versions.getHistory("orders")[0].compatibility).toBe("backward");
    expect(versions.getHistory("orders")[1].compatibility).toBe("breaking");
    expect(versions.getBreakingChanges("orders")).toHaveLength(1);

    // 결제가 member_id를 기대하면 호환 실패
    const compat = checkCompatibility(
      { fields: { id: { type: "string", required: true }, total_amount: { type: "number", required: true } } },
      { fields: { id: { type: "string", required: true }, total_amount: { type: "number", required: true }, member_id: { type: "string", required: true } } },
    );
    expect(compat.breaking).toBe(true);
    expect(compat.missingFields).toContain("member_id");
  });

  it("11. Constraint 정의 → 실행 → 오류 추적", () => {
    const registry = new ConstraintRegistry();

    // constraint: 주문 스키마에 결제 필수 필드 존재
    const c1: ConstraintDef = {
      constraintId: "order-payment-compat",
      specId: "order-system",
      subject: { kind: "contract", ref: "order→payment" },
      predicate: { op: "superset-of", expected: ["id", "total_amount", "status"] },
      context: { when: "on-schema-change" },
      evidence: { method: "contract-test", testAddresses: ["test:1:3:소비:1"], reversible: true },
      severity: "critical",
      description: "결제가 기대하는 필드가 주문에 존재해야 함",
    };

    // constraint: 주문 금액 > 0
    const c2: ConstraintDef = {
      constraintId: "order-amount-positive",
      specId: "order-system",
      subject: { kind: "field", ref: "orders", field: "total_amount" },
      predicate: { op: "gt", expected: 0 },
      context: { when: "on-pipe-execution" },
      evidence: { method: "unit-test", reversible: true },
      severity: "error",
      description: "주문 금액은 0보다 커야 함",
    };

    // constraint: 파이프 경로 수 ≤ 10
    const c3: ConstraintDef = {
      constraintId: "pipe-complexity-limit",
      specId: "order-system",
      subject: { kind: "pipe-graph", ref: "order-system" },
      predicate: { op: "lte", expected: 10 },
      context: { when: "always" },
      evidence: { method: "invariant-check", reversible: true },
      severity: "warning",
      description: "파이프 그래프 경로 수가 10 이하여야 함",
    };

    registry.register(c1);
    registry.register(c2);
    registry.register(c3);

    // 실행
    registry.recordResult(executeConstraint(c1, ["id", "total_amount", "status", "member_id"])); // pass
    registry.recordResult(executeConstraint(c2, 50000));  // pass
    registry.recordResult(executeConstraint(c3, countGraphPaths(orderSystem))); // pass (경로 ≤ 10)

    const status = registry.getSpecVerificationStatus("order-system");
    expect(status.total).toBe(3);
    expect(status.verified).toBe(3);
    expect(status.verificationRate).toBe(100);

    // 스키마 변경으로 c1 실패 시뮬레이션
    registry.recordResult(executeConstraint(c1, ["id", "total_amount"])); // status 누락 → fail

    const failures = registry.getFailures();
    expect(failures).toHaveLength(1);
    expect(failures[0].constraintId).toBe("order-payment-compat");
    expect(failures[0].failureTrace!.subject.ref).toBe("order→payment");
    expect(failures[0].failureTrace!.predicate.op).toBe("superset-of");
    expect(failures[0].failureTrace!.context.when).toBe("on-schema-change");
  });

  it("12. 전체 품질 대시보드", () => {
    const registry = new ConstraintRegistry();

    // 여러 스펙의 constraint
    for (let i = 0; i < 5; i++) {
      const c: ConstraintDef = {
        constraintId: `order-c${i}`, specId: "order-system",
        subject: { kind: "schema", ref: "orders" },
        predicate: { op: "exists" },
        context: { when: "always" },
        evidence: { method: "unit-test", reversible: true },
        severity: "error", description: `order constraint ${i}`,
      };
      registry.register(c);
      if (i < 4) registry.recordResult(executeConstraint(c, "value")); // 4개 pass, 1개 미실행
    }

    for (let i = 0; i < 3; i++) {
      const c: ConstraintDef = {
        constraintId: `payment-c${i}`, specId: "payment-system",
        subject: { kind: "pipe", ref: "payment" },
        predicate: { op: "eq", expected: true },
        context: { when: "always" },
        evidence: { method: "integration-test", reversible: true },
        severity: "error", description: `payment constraint ${i}`,
      };
      registry.register(c);
      registry.recordResult(executeConstraint(c, i < 2 ? true : false)); // 2 pass, 1 fail
    }

    const system = registry.getSystemStatus();
    expect(system.totalConstraints).toBe(8);
    expect(system.totalVerified).toBe(6);   // 4 + 2
    expect(system.totalFailed).toBe(1);
    expect(system.totalUntested).toBe(1);
    expect(system.specBreakdown["order-system"].rate).toBe(80);
    expect(system.specBreakdown["payment-system"].rate).toBe(67);
  });
});
