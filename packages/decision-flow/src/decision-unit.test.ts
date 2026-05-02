/**
 * 의사결정 단위 검토
 *
 * 1. 주제/목적/결론이 명확하게 표현되는가
 * 2. 과정(journey)과 결론(verdict)이 구분되는가
 * 3. 결론이 나중에(시간 경과 후) 기록될 수 있는가
 */

import { describe, it, expect } from "vitest";
import { FlowEngine } from "./engine.js";
import {
  buildNarrative,
  recordVerdict,
  evaluateDecision,
  summarizeDecisionOutcome,
} from "./narrative.js";
import { DEV_DECISION_UNITS, TEST_NEEDED_FLOW, STABILIZATION_FLOW } from "./dev-decisions.js";
import type { Evidence, FlowSchema, DecisionUnit } from "./types.js";

function ev(kind: Evidence["kind"], content: string, weight = 0.8): Evidence {
  return { kind, source: "review", content, weight };
}

// FlowSchema에 unit을 부여하는 헬퍼
function withUnit(schema: FlowSchema, unit: DecisionUnit): FlowSchema {
  return { ...schema, unit };
}

// ─── 주제/목적/결론의 명확성 ─────────────────────────────

describe("의사결정 단위 — 주제/목적/결론이 명확한가", () => {
  it("test-needed: 주제, 목적, 성공 기준 4개가 명확히 정의됨", () => {
    const unit = DEV_DECISION_UNITS["test-needed"];

    expect(unit.topic).toBe("이 변경에 테스트가 필요한가");
    expect(unit.objective).toContain("불필요한 테스트 작성을 방지");
    expect(unit.successCriteria.length).toBe(4);
    expect(unit.fallback).toContain("통합 테스트");

    // 성공 기준이 측정 가능한가 (시간, 수량, 비교 포함)
    expect(unit.successCriteria[3]).toContain("1주일");
  });

  it("stabilization: 주제, 목적, 성공 기준이 실측 가능하게 정의됨", () => {
    const unit = DEV_DECISION_UNITS["stabilization"];

    expect(unit.topic).toContain("안정화");
    expect(unit.successCriteria).toContain("버그 빈도가 정확히 측정됨");
    expect(unit.successCriteria.some((c) => c.includes("1개월"))).toBe(true);
  });
});

// ─── 과정과 결론의 분리 ─────────────────────────────────

describe("과정(journey)과 결론(verdict)의 분리", () => {
  it("과정이 완료된 시점에는 verdict가 없다", () => {
    const schema = withUnit(TEST_NEEDED_FLOW, DEV_DECISION_UNITS["test-needed"]);
    const engine = new FlowEngine();
    engine.registerSchema(schema);

    const inst = engine.startFlow("test-needed");
    engine.selectBranch(inst.id, "new-feature", [ev("data", "새 API 추가")]);
    engine.selectBranch(inst.id, "system", [ev("data", "3개 서비스 호출")]);
    engine.selectBranch(inst.id, "none", [ev("data", "관련 테스트 없음")]);
    const result = engine.selectBranch(inst.id, "add-e2e", [ev("rule", "시스템 영향 → E2E")]);

    // 과정 완료
    expect(result.status).toBe("completed");

    // 서사 생성 — verdict는 아직 없음
    const narrative = buildNarrative({
      instance: result,
      schema,
      context: { source: "pr-review", trigger: "새 API 추가 PR" },
      outcome: { artifactType: "test-plan", artifactRef: "E2E 테스트 추가 예정" },
    });

    expect(narrative.unit).toBeDefined();
    expect(narrative.unit!.topic).toBe("이 변경에 테스트가 필요한가");
    expect(narrative.verdict).toBeUndefined();

    // 과정 요약 — 결론은 "아직 판정 전"
    const summary = summarizeDecisionOutcome(narrative);
    expect(summary).toContain("[주제]");
    expect(summary).toContain("[결정]");
    expect(summary).toContain("아직 판정 전");
  });

  it("시간이 지난 후 verdict를 기록할 수 있다", () => {
    const schema = withUnit(TEST_NEEDED_FLOW, DEV_DECISION_UNITS["test-needed"]);
    const engine = new FlowEngine();
    engine.registerSchema(schema);

    const inst = engine.startFlow("test-needed");
    engine.selectBranch(inst.id, "new-feature", [ev("data", "새 API")]);
    engine.selectBranch(inst.id, "system", [ev("data", "시스템 영향")]);
    engine.selectBranch(inst.id, "none");
    const result = engine.selectBranch(inst.id, "add-e2e", [ev("rule", "E2E 추가")]);

    const narrative = buildNarrative({
      instance: result,
      schema,
      context: { source: "pr", trigger: "PR 리뷰" },
      outcome: { artifactType: "test", artifactRef: "e2e-tests" },
    });

    // 1주일 후 — 성공 기준 평가
    const verdict = evaluateDecision(narrative, [
      { criterion: "변경의 성격이 정확히 분류됨", met: true, evidence: "new-feature 정확" },
      { criterion: "영향 범위가 올바르게 판단됨", met: true, evidence: "system 맞음" },
      { criterion: "판정 결과가 실제 위험에 비례함", met: true, evidence: "E2E가 적절" },
      { criterion: "1주일 내 관련 버그 미발생", met: true, evidence: "0건" },
    ]);

    expect(verdict.verdict).toBe("success");
    expect(verdict.criteriaResults.length).toBe(4);
    expect(verdict.criteriaResults.every((r) => r.met)).toBe(true);

    // 서사에 판정 기록
    const withVerdict = recordVerdict(narrative, verdict);
    expect(withVerdict.verdict).toBeDefined();
    expect(withVerdict.verdict!.verdict).toBe("success");

    // 원본은 불변
    expect(narrative.verdict).toBeUndefined();

    // 결론 포함 요약
    const summary = summarizeDecisionOutcome(withVerdict);
    expect(summary).toContain("[결론] success");
    expect(summary).toContain("4/4 기준 충족");
  });

  it("부분 충족 시 deferred 판정", () => {
    const schema = withUnit(STABILIZATION_FLOW, DEV_DECISION_UNITS["stabilization"]);
    const engine = new FlowEngine();
    engine.registerSchema(schema);

    const inst = engine.startFlow("stabilization");
    engine.selectBranch(inst.id, "moderate", [ev("data", "월 2회 버그")]);
    engine.selectBranch(inst.id, "borderline", [ev("data", "SLA 경계")]);
    engine.selectBranch(inst.id, "acceptable");
    const result = engine.selectBranch(inst.id, "needs-fix", [ev("rule", "개선 필요")]);

    const narrative = buildNarrative({
      instance: result,
      schema,
      context: { source: "monitor", trigger: "안정화 점검" },
      outcome: { artifactType: "fix-plan", artifactRef: "bug-fix-sprint" },
    });

    // 1개월 후 — 일부만 충족
    const verdict = evaluateDecision(narrative, [
      { criterion: "버그 빈도가 정확히 측정됨", met: true },
      { criterion: "성능이 SLA 대비 정확히 평가됨", met: true },
      { criterion: "판정 결과가 실제 상태에 비례함", met: true },
      { criterion: "조치 후 버그 빈도 감소 또는 1개월 내 인시던트 없음", met: false, evidence: "버그 1건 추가 발생" },
    ]);

    expect(verdict.verdict).toBe("deferred");
    expect(verdict.reason).toContain("3개 충족");
  });
});

// ─── 단위가 서사 전체를 관통하는가 ──────────────────────

describe("DecisionUnit이 서사 전체를 관통한다", () => {
  it("주제 → 여정 → 판정이 하나의 스토리로 읽힌다", () => {
    const schema = withUnit(TEST_NEEDED_FLOW, DEV_DECISION_UNITS["test-needed"]);
    const engine = new FlowEngine();
    engine.registerSchema(schema);

    const inst = engine.startFlow("test-needed");
    engine.selectBranch(inst.id, "refactor", [ev("data", "함수 추출 리팩터링")]);
    engine.selectBranch(inst.id, "local", [ev("data", "이 파일만 변경")]);
    engine.selectBranch(inst.id, "sufficient", [ev("data", "기존 테스트가 커버")]);
    const result = engine.selectBranch(inst.id, "not-needed", [
      ev("rule", "리팩터+국소+충분 = 불필요"),
    ]);

    const narrative = buildNarrative({
      instance: result,
      schema,
      context: { source: "self", trigger: "함수 추출 리팩터링" },
      outcome: { artifactType: "no-action", artifactRef: "테스트 추가 없음" },
    });

    const withVerdict = recordVerdict(narrative, evaluateDecision(narrative, [
      { criterion: "변경의 성격이 정확히 분류됨", met: true },
      { criterion: "영향 범위가 올바르게 판단됨", met: true },
      { criterion: "판정 결과가 실제 위험에 비례함", met: true },
      { criterion: "1주일 내 관련 버그 미발생", met: true },
    ]));

    // 전체 스토리 요약
    const story = summarizeDecisionOutcome(withVerdict);

    // 주제가 보인다
    expect(story).toContain("이 변경에 테스트가 필요한가");
    // 결정 과정이 보인다
    expect(story).toContain("[결정]");
    // 결론이 보인다
    expect(story).toContain("[결론] success");
    // 하나의 스토리로 읽힌다
    expect(story.split("\n").length).toBeGreaterThanOrEqual(3);
  });
});
