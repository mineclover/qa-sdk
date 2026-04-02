/**
 * 시뮬레이션 시나리오 — PipeFlow vs ConnectionKind 차이 + 실전 패턴
 */
import { describe, it, expect } from "vitest";
import { simulate } from "./pipe-simulate.js";
import { countPipePaths, countGraphPaths } from "./pipe-path.js";
import type { PipeSpec, PipeGraph, PipeFlow } from "../types/pipe-spec.js";

import { step } from "./__fixtures__/pipe-fixtures.js";

function makePipe(id: string, trigger: string, flow: PipeFlow, produces?: string[]): PipeSpec {
  return { pipeId: id, version: "v1", trigger: { eventKey: trigger }, flow, produces };
}

// ═══════════════════════════════════════════════════════
// 1. PipeFlow vs ConnectionKind 차이
// ═══════════════════════════════════════════════════════

describe("PipeFlow vs ConnectionKind — 같은 개념, 다른 레벨", () => {

  describe("parallel(PipeFlow) vs fan-out(ConnectionKind)", () => {
    it("PipeFlow.parallel — 한 파이프 안에서 두 패싯 동시 실행", () => {
      // 하나의 파이프 안에서 검증A + 검증B를 동시에
      const pipe = makePipe("validator", "start", {
        kind: "parallel",
        steps: [
          step("관리", "validate_schema"),
          step("관리", "validate_business_rule"),
        ],
      });
      const r = simulate({
        graph: { graphId: "g", version: "v1", pipes: [pipe], connections: [], entryPipeId: "validator" },
        initialEvent: { eventKey: "start" },
      });
      // 한 파이프 안에서 두 step이 실행됨
      expect(r.pipeTrace).toEqual(["validator"]);
      expect(r.steps.filter(s => s.kind === "step")).toHaveLength(2);
    });

    it("ConnectionKind.fan-out — 두 파이프를 동시에 시작", () => {
      // 두 독립 파이프(결제 + 재고)를 동시 시작
      const graph: PipeGraph = {
        graphId: "g", version: "v1",
        pipes: [
          makePipe("order", "start", step("소비"), ["order_done"]),
          makePipe("payment", "pay", step("관리", "charge")),
          makePipe("inventory", "inv", step("관리", "reserve")),
        ],
        connections: [
          { from: "order", to: ["payment", "inventory"], kind: "fan-out" },
        ],
        entryPipeId: "order",
      };
      const r = simulate({ graph, initialEvent: { eventKey: "start" } });
      // 세 개의 독립 파이프가 실행됨
      expect(r.pipeTrace).toContain("order");
      expect(r.pipeTrace).toContain("payment");
      expect(r.pipeTrace).toContain("inventory");
    });

    it("차이 — parallel은 경로 곱, fan-out도 경로 곱이지만 독립 파이프", () => {
      // PipeFlow.parallel: 1 파이프 × 내부 2 step 동시
      expect(countPipePaths({ kind: "parallel", steps: [step("a"), step("b")] })).toBe(1);

      // ConnectionKind.fan-out: 파이프 A의 경로 × (파이프 B 경로 × 파이프 C 경로)
      const graph: PipeGraph = {
        graphId: "g", version: "v1",
        pipes: [
          makePipe("a", "s", step("소비")),
          makePipe("b", "b", { kind: "branch", condition: "x", paths: [step("a"), step("b")] }),
          makePipe("c", "c", step("관리")),
        ],
        connections: [{ from: "a", to: ["b", "c"], kind: "fan-out" }],
        entryPipeId: "a",
      };
      // a(1) × fan-out(b(2) × c(1)) = 2
      expect(countGraphPaths(graph)).toBe(2);
    });
  });

  describe("branch(PipeFlow) vs conditional(ConnectionKind)", () => {
    it("PipeFlow.branch — 한 파이프 안에서 조건 분기", () => {
      const pipe = makePipe("processor", "start", {
        kind: "branch", condition: "type",
        paths: [
          step("생산", "type_a_result"),
          step("생산", "type_b_result"),
          step("생산", "type_c_result"),
        ],
      });
      // 내부 3경로
      expect(countPipePaths(pipe.flow)).toBe(3);

      const r = simulate({
        graph: { graphId: "g", version: "v1", pipes: [pipe], connections: [], entryPipeId: "processor" },
        initialEvent: { eventKey: "start" },
        branchResolver: () => 2, // 세 번째 경로
      });
      expect(r.steps.find(s => s.eventKey === "type_c_result")).toBeDefined();
    });

    it("ConnectionKind.conditional — 파이프 간 조건부 연결", () => {
      const graph: PipeGraph = {
        graphId: "g", version: "v1",
        pipes: [
          makePipe("router", "start", step("관리", "classify")),
          makePipe("fast-track", "ft", step("생산", "fast")),
          makePipe("normal-track", "nt", step("생산", "normal")),
        ],
        connections: [
          { from: "router", to: "fast-track", kind: "conditional", condition: "priority === 'high'" },
          { from: "router", to: "normal-track", kind: "conditional", condition: "priority !== 'high'" },
        ],
        entryPipeId: "router",
      };

      // 조건 true → fast-track
      const r1 = simulate({
        graph, initialEvent: { eventKey: "start" },
        filterResolver: (cond) => cond.includes("high"),
      });
      expect(r1.pipeTrace).toContain("fast-track");

      // 조건 false → 둘 다 미실행 (conditional은 개별 평가)
      const r2 = simulate({
        graph, initialEvent: { eventKey: "start" },
        filterResolver: () => false,
      });
      // conditional 모두 false → 아무 파이프도 연결 안 됨
      expect(r2.pipeTrace).toEqual(["router"]);
    });
  });

  describe("compensate(PipeFlow) vs compensate(ConnectionKind)", () => {
    it("PipeFlow.compensate — 한 파이프 안에서 forward + undo", () => {
      const r = simulate({
        graph: {
          graphId: "g", version: "v1",
          pipes: [makePipe("p", "start", {
            kind: "compensate",
            forward: step("생산", "create"),
            compensate: step("관리", "undo"),
          })],
          connections: [],
          entryPipeId: "p",
        },
        initialEvent: { eventKey: "start" },
      });
      // 시뮬레이션에서는 forward만 실행 (정상 경로)
      expect(r.steps.find(s => s.eventKey === "create")).toBeDefined();
    });

    it("ConnectionKind.compensate — 파이프 간 보상 연결", () => {
      // payment 후속 실패 시 order 보상
      const graph: PipeGraph = {
        graphId: "g", version: "v1",
        pipes: [
          makePipe("order", "start", step("생산", "create_order")),
          makePipe("payment", "pay", step("관리", "charge")),
          makePipe("cancel-order", "cancel", step("관리", "cancel")),
        ],
        connections: [
          { from: "order", to: "payment", kind: "next" },
          { from: "payment", to: "cancel-order", kind: "compensate" },
        ],
        entryPipeId: "order",
      };
      // 정상 시뮬에서는 compensate 연결 미실행 (에러 시만)
      const r = simulate({ graph, initialEvent: { eventKey: "start" } });
      expect(r.pipeTrace).toContain("order");
      expect(r.pipeTrace).toContain("payment");
      // cancel-order는 에러 시에만 실행되므로 정상에서는 미포함
    });
  });
});

// ═══════════════════════════════════════════════════════
// 2. 피드백 루프 시나리오
// ═══════════════════════════════════════════════════════

describe("피드백 루프 시나리오", () => {

  it("PID 제어: sensor → compute → actuator → feedback", () => {
    const controllerPipe = makePipe("controller", "sensor_reading", {
      kind: "feedback",
      body: {
        kind: "sequence",
        steps: [
          step("소비", "read_sensor"),      // 센서 값 읽기
          step("관리", "compute_error"),      // 오차 계산
          step("생산", "adjust_actuator"),    // 액추에이터 조정
        ],
      },
      feedbackEvent: "sensor_reading",
      until: "error < 0.01",
      maxIterations: 100,
    });

    const r = simulate({
      graph: {
        graphId: "pid", version: "v1",
        pipes: [controllerPipe],
        connections: [],
        entryPipeId: "controller",
      },
      initialEvent: { eventKey: "sensor_reading" },
      maxSteps: 20,  // 피드백 루프이므로 제한
    });

    expect(r.facetTrace).toContain("소비");
    expect(r.facetTrace).toContain("관리");
    expect(r.facetTrace).toContain("생산");
    // maxSteps에 도달하거나 정상 완료
    expect(["complete", "max-steps-reached"]).toContain(r.status);
  });

  it("ML 학습 루프: train → evaluate → adjust → repeat", () => {
    const trainingPipe = makePipe("trainer", "train_start", {
      kind: "feedback",
      body: {
        kind: "sequence",
        steps: [
          step("소비", "load_batch"),        // 배치 데이터 로드
          step("생산", "forward_pass"),       // 순전파
          step("관리", "compute_loss"),       // 손실 계산
          step("생산", "backward_pass"),      // 역전파
          step("저장", "update_weights"),     // 가중치 갱신
        ],
      },
      feedbackEvent: "train_start",
      until: "loss < 0.001",
      maxIterations: 1000,
    });

    const r = simulate({
      graph: {
        graphId: "ml", version: "v1",
        pipes: [trainingPipe],
        connections: [],
        entryPipeId: "trainer",
      },
      initialEvent: { eventKey: "train_start" },
      maxSteps: 15,
    });

    expect(r.facetTrace).toContain("소비");
    expect(r.facetTrace).toContain("생산");
    expect(r.facetTrace).toContain("관리");
    expect(r.facetTrace).toContain("저장");
  });

  it("이벤트 기반 폐루프: A produces → B triggers → B produces → A triggers", () => {
    const graph: PipeGraph = {
      graphId: "loop", version: "v1",
      pipes: [
        makePipe("producer", "signal_a", step("생산", "process_a"), ["signal_b"]),
        makePipe("consumer", "signal_b", step("소비", "process_b"), ["signal_a"]),
      ],
      connections: [],
      entryPipeId: "producer",
    };

    const r = simulate({
      graph,
      initialEvent: { eventKey: "signal_a" },
      maxSteps: 10,
    });

    expect(r.status).toBe("max-steps-reached");
    expect(r.pipeTrace.filter(id => id === "producer").length).toBeGreaterThan(1);
    expect(r.pipeTrace.filter(id => id === "consumer").length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════
// 3. Human-in-the-Loop 시나리오
// ═══════════════════════════════════════════════════════

describe("Human-in-the-Loop 시나리오", () => {

  it("승인 워크플로우: 자동 처리 → 금액 확인 → 사람 승인 대기 → 진행", () => {
    const approvalPipe = makePipe("approval-flow", "request_submitted", {
      kind: "sequence",
      steps: [
        step("소비", "receive_request"),
        step("관리", "auto_validate"),
        // 금액이 크면 사람 승인 필요
        { kind: "branch", condition: "amount > 1000000",
          paths: [
            // 고액: 사람 승인 대기
            {
              kind: "await",
              condition: "human_approval_received",
              timeout: 86400000, // 24시간
              then: step("관리", "approval_check"),
            },
            // 소액: 자동 승인
            step("관리", "auto_approve"),
          ],
        },
        step("생산", "process_approved"),
        step("저장", "save_result"),
      ],
    });

    // 고액 경로 (branchResolver=0 → await 경로)
    const highAmount = simulate({
      graph: {
        graphId: "approval", version: "v1",
        pipes: [approvalPipe], connections: [], entryPipeId: "approval-flow",
      },
      initialEvent: { eventKey: "request_submitted" },
      branchResolver: () => 0,
    });
    expect(highAmount.steps.some(s => s.kind === "await")).toBe(true);
    expect(highAmount.steps.find(s => s.eventKey === "approval_check")).toBeDefined();
    expect(highAmount.totalTime).toBeGreaterThanOrEqual(86400000);

    // 소액 경로 (branchResolver=1 → auto_approve)
    const lowAmount = simulate({
      graph: {
        graphId: "approval", version: "v1",
        pipes: [approvalPipe], connections: [], entryPipeId: "approval-flow",
      },
      initialEvent: { eventKey: "request_submitted" },
      branchResolver: () => 1,
    });
    expect(lowAmount.steps.find(s => s.eventKey === "auto_approve")).toBeDefined();
    expect(lowAmount.totalTime).toBeLessThan(86400000);
  });

  it("콘텐츠 심사: AI 분류 → 신뢰도 분기 → 사람 리뷰 또는 자동 승인", () => {
    const moderationPipe = makePipe("moderation", "content_submitted", {
      kind: "sequence",
      steps: [
        step("소비", "receive_content"),
        step("관리", "ai_classify"),
        { kind: "branch", condition: "confidence",
          paths: [
            // 고신뢰: 자동 처리
            step("생산", "auto_decision"),
            // 저신뢰: 사람 리뷰 → 대기 → 결정
            {
              kind: "sequence",
              steps: [
                { kind: "emit", eventKey: "review_requested" },
                {
                  kind: "await",
                  condition: "human_review_complete",
                  timeout: 3600000, // 1시간
                  then: step("소비", "human_decision"),
                },
              ],
            },
            // 위험: 즉시 차단 + 사람에게 알림
            {
              kind: "sequence",
              steps: [
                step("관리", "auto_block"),
                { kind: "emit", eventKey: "escalation_alert" },
              ],
            },
          ],
        },
        step("저장", "save_decision"),
      ],
    });

    // 고신뢰 → 자동
    const highConf = simulate({
      graph: {
        graphId: "mod", version: "v1",
        pipes: [moderationPipe], connections: [], entryPipeId: "moderation",
      },
      initialEvent: { eventKey: "content_submitted" },
      branchResolver: () => 0,
    });
    expect(highConf.steps.find(s => s.eventKey === "auto_decision")).toBeDefined();

    // 저신뢰 → 사람 리뷰 대기
    const lowConf = simulate({
      graph: {
        graphId: "mod", version: "v1",
        pipes: [moderationPipe], connections: [], entryPipeId: "moderation",
      },
      initialEvent: { eventKey: "content_submitted" },
      branchResolver: () => 1,
    });
    expect(lowConf.producedEvents.map(e => e.eventKey)).toContain("review_requested");
    expect(lowConf.steps.some(s => s.kind === "await")).toBe(true);
    expect(lowConf.steps.find(s => s.eventKey === "human_decision")).toBeDefined();

    // 위험 → 즉시 차단 + 에스컬레이션
    const dangerous = simulate({
      graph: {
        graphId: "mod", version: "v1",
        pipes: [moderationPipe], connections: [], entryPipeId: "moderation",
      },
      initialEvent: { eventKey: "content_submitted" },
      branchResolver: () => 2,
    });
    expect(dangerous.steps.find(s => s.eventKey === "auto_block")).toBeDefined();
    expect(dangerous.producedEvents.map(e => e.eventKey)).toContain("escalation_alert");
  });

  it("예외 처리 에스컬레이션: 자동 해결 시도 → 실패 → 사람 에스컬레이션", () => {
    const exceptionPipe = makePipe("exception-handler", "error_detected", {
      kind: "fallback",
      try: {
        kind: "retry",
        maxAttempts: 3,
        backoff: 1000,
        step: step("관리", "auto_resolve"),
      },
      catch: {
        kind: "sequence",
        steps: [
          step("생산", "create_ticket"),
          { kind: "emit", eventKey: "human_alert" },
          {
            kind: "await",
            condition: "human_resolved",
            timeout: 7200000, // 2시간
            then: step("소비", "apply_human_fix"),
          },
          step("저장", "log_resolution"),
        ],
      },
    });

    // 자동 해결 성공 (failureResolver=true)
    const autoResolved = simulate({
      graph: {
        graphId: "exc", version: "v1",
        pipes: [exceptionPipe], connections: [], entryPipeId: "exception-handler",
      },
      initialEvent: { eventKey: "error_detected" },
      failureResolver: () => true,
    });
    expect(autoResolved.steps.find(s => s.eventKey === "auto_resolve")).toBeDefined();
    expect(autoResolved.steps.find(s => s.eventKey === "create_ticket")).toBeUndefined();

    // 자동 해결 실패 → 사람 에스컬레이션 (failureResolver=false)
    const escalated = simulate({
      graph: {
        graphId: "exc", version: "v1",
        pipes: [exceptionPipe], connections: [], entryPipeId: "exception-handler",
      },
      initialEvent: { eventKey: "error_detected" },
      failureResolver: () => false,
    });
    expect(escalated.steps.find(s => s.eventKey === "create_ticket")).toBeDefined();
    expect(escalated.producedEvents.map(e => e.eventKey)).toContain("human_alert");
    expect(escalated.steps.some(s => s.kind === "await")).toBe(true);
    expect(escalated.steps.find(s => s.eventKey === "apply_human_fix")).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════
// 4. 복합 엔터프라이즈 시나리오
// ═══════════════════════════════════════════════════════

describe("복합 엔터프라이즈 시나리오", () => {

  it("주문→결제→재고→배송→알림 전체 파이프라인 + saga 보상", () => {
    const graph: PipeGraph = {
      graphId: "enterprise-order", version: "v1",
      pipes: [
        // 1. 주문 접수
        makePipe("order", "order_submitted", {
          kind: "sequence",
          steps: [
            step("소비", "receive_order"),
            step("관리", "validate_order"),
            { kind: "branch", condition: "stock_available",
              paths: [step("생산", "order_confirmed"), step("생산", "order_rejected")],
            },
          ],
        }, ["order_confirmed"]),

        // 2. 결제 (retry + fallback + finally)
        makePipe("payment", "pay", {
          kind: "finally",
          body: {
            kind: "retry", maxAttempts: 3,
            step: {
              kind: "fallback",
              try: step("관리", "pg_primary"),
              catch: step("관리", "pg_secondary"),
            },
          },
          cleanup: step("저장", "payment_audit_log"),
        }, ["payment_done"]),

        // 3. 재고 예약
        makePipe("inventory", "reserve", step("관리", "reserve_stock"), ["stock_reserved"]),

        // 4. 배송 생성
        makePipe("shipping", "ship", {
          kind: "sequence",
          steps: [
            step("생산", "create_shipment"),
            { kind: "tap",
              observe: step("관리", "track_metric"),
              step: step("저장", "save_shipment"),
            },
          ],
        }, ["shipment_created"]),

        // 5. 알림 (배치 + dedup + throttle)
        makePipe("notify", "notify_trigger", {
          kind: "throttle",
          rate: 100,
          interval: 1000,
          step: {
            kind: "dedup",
            keyField: "userId",
            step: { kind: "emit", eventKey: "notification_sent" },
          },
        }),
      ],
      connections: [
        // 주문 확정 → 결제 + 재고 동시
        { from: "order", to: ["payment", "inventory"], kind: "fan-out" },
        // 결제 + 재고 완료 → 배송
        { from: ["payment", "inventory"], to: "shipping", kind: "join" },
        // 배송 → 알림
        { from: "shipping", to: "notify", kind: "next" },
        // 결제 실패 시 주문 보상
        { from: "payment", to: "order", kind: "compensate" },
      ],
      entryPipeId: "order",
    };

    // 정상 경로 (재고 있음 + 결제 성공)
    const success = simulate({
      graph,
      initialEvent: { eventKey: "order_submitted" },
      branchResolver: () => 0,
      failureResolver: () => true,
    });

    expect(success.status).toBe("complete");
    expect(success.pipeTrace).toContain("order");
    expect(success.pipeTrace).toContain("payment");
    expect(success.pipeTrace).toContain("inventory");
    expect(success.pipeTrace).toContain("shipping");
    expect(success.pipeTrace).toContain("notify");

    // 결제 audit log (finally.cleanup) 실행 확인
    expect(success.steps.find(s => s.eventKey === "payment_audit_log")).toBeDefined();
    // tap observe 실행 확인
    expect(success.steps.find(s => s.eventKey === "track_metric")).toBeDefined();
    // 알림 이벤트 확인
    expect(success.producedEvents.map(e => e.eventKey)).toContain("notification_sent");

    // 결제 실패 경로 (PG primary 실패 → PG secondary)
    const pgFail = simulate({
      graph,
      initialEvent: { eventKey: "order_submitted" },
      branchResolver: () => 0,
      failureResolver: () => false,
    });
    expect(pgFail.steps.find(s => s.eventKey === "pg_secondary")).toBeDefined();
  });
});
