// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios
//
// 결정 객체 단언 헬퍼 — Plan E Stage 11 §11.1.
//
// spec 05 §3.1 원칙:
//   (a) 결정 record 필드 직접 비교 — 부수효과(gateway weight, replica count, audit append)는
//       보강 단언으로만 사용.
//   (b) decisionId/cycleId는 03-identifier-grammar 라운드트립 통과 검증.
//   (c) (cycleId, pass) unique — 같은 cycleId 결정 row 정확히 1건.

import { equal, deepEqual, ok } from "node:assert/strict";
import { parseDecisionId, parseCycleId } from "sim-identifier-grammar";
import type {
  AnyDecision,
  CategoryVerdictValue,
  ResourceDecisionRecordView,
  ResourceRejectedBy,
  SafetyDecisionRecordView,
  SafetyTriggerCategory,
  SafetyVerdict,
  ResourceVerdict,
} from "../audit-fetcher.js";

export interface SafetyExpectation {
  verdict: SafetyVerdict;
  triggerCategory?: SafetyTriggerCategory;
  categoryVerdicts?: Partial<SafetyDecisionRecordView["categoryVerdicts"]>;
  action?: SafetyDecisionRecordView["action"];
  minConfidence?: number;
}

export interface ResourceExpectation {
  verdict: ResourceVerdict;
  rejectedBy?: ResourceRejectedBy;
  target?: { v1: number; v2: number };
  triggerSignals?: readonly string[];
}

/**
 * grammar 라운드트립 헬퍼 — parseDecisionId/parseCycleId는 invalid 시 throw.
 * 단언 메시지를 명확히 하기 위해 try/catch로 감싼다.
 */
function assertGrammarRoundtrip(
  parser: (s: string) => unknown,
  value: string,
  label: string,
): void {
  try {
    parser(value);
  } catch (e) {
    throw new Error(
      `${label} grammar invalid: ${value} (${(e as Error).message})`,
    );
  }
}

/**
 * Pass 1 (Safety) 결정 record 단언.
 *
 * spec 05 §3.1 (a): verdict + triggerCategory + categoryVerdicts subset + action 직접 비교.
 * spec 05 §3.1 (b): decisionId/cycleId 라운드트립 검증.
 */
export function assertSafetyVerdict(
  d: SafetyDecisionRecordView,
  e: SafetyExpectation,
): void {
  assertGrammarRoundtrip(parseDecisionId, d.decisionId, "decisionId");
  assertGrammarRoundtrip(parseCycleId, d.cycleId, "cycleId");
  equal(d.pass, "safety", "pass must be 'safety'");
  equal(
    d.verdict,
    e.verdict,
    `verdict expected=${e.verdict} actual=${d.verdict}`,
  );
  if (e.triggerCategory !== undefined) {
    equal(
      d.triggerCategory,
      e.triggerCategory,
      `triggerCategory expected=${e.triggerCategory} actual=${d.triggerCategory}`,
    );
  }
  if (e.categoryVerdicts) {
    for (const [k, v] of Object.entries(e.categoryVerdicts) as [
      keyof SafetyDecisionRecordView["categoryVerdicts"],
      CategoryVerdictValue,
    ][]) {
      const actual = d.categoryVerdicts[k];
      equal(
        actual,
        v,
        `categoryVerdicts.${k} expected=${v} actual=${actual}`,
      );
    }
  }
  if (e.action !== undefined) {
    deepEqual(d.action, e.action, "action mismatch");
  }
  if (e.minConfidence !== undefined) {
    ok(
      d.confidence >= e.minConfidence,
      `confidence ${d.confidence} < ${e.minConfidence}`,
    );
  }
}

/**
 * Pass 1 rollback의 triggerCategory invariant — categoryVerdicts.<trigger>가 FAIL이어야 함.
 * spec 05 §3.1 — rollback verdict 일 때만 triggerCategory가 의미를 가짐.
 */
export function assertTriggerCategory(
  d: SafetyDecisionRecordView,
  expected: SafetyTriggerCategory,
): void {
  equal(d.verdict, "rollback", "triggerCategory only valid on rollback");
  equal(d.triggerCategory, expected, `triggerCategory expected=${expected}`);
  const cv = d.categoryVerdicts[expected];
  equal(
    cv,
    "FAIL",
    `categoryVerdicts.${expected} must be FAIL when trigger matches, got=${cv}`,
  );
}

/**
 * Pass 2 (Resource) 결정 record 단언.
 *
 * verdict=rejected 시 rejectedBy 필수, scale-up/down 시 target invariant.
 */
export function assertResourceVerdict(
  d: ResourceDecisionRecordView,
  e: ResourceExpectation,
): void {
  assertGrammarRoundtrip(parseDecisionId, d.decisionId, "decisionId");
  assertGrammarRoundtrip(parseCycleId, d.cycleId, "cycleId");
  equal(d.pass, "resource", "pass must be 'resource'");
  equal(
    d.verdict,
    e.verdict,
    `verdict expected=${e.verdict} actual=${d.verdict}`,
  );
  if (e.verdict === "rejected") {
    ok(d.rejectedBy, "rejected verdict requires rejectedBy");
    if (e.rejectedBy) {
      equal(
        d.rejectedBy,
        e.rejectedBy,
        `rejectedBy expected=${e.rejectedBy} actual=${d.rejectedBy}`,
      );
    }
  }
  if (e.target && d.action?.kind === "scale") {
    deepEqual(d.action.target, e.target, "action.target mismatch");
  }
  if (e.triggerSignals) {
    for (const s of e.triggerSignals) {
      ok(
        d.triggerSignals.includes(s),
        `triggerSignals missing: ${s} (got ${JSON.stringify(d.triggerSignals)})`,
      );
    }
  }
}

/**
 * spec 05 §3.1 (c) — (cycleId, pass) unique 보장.
 * 같은 cycleId+pass 조합이 두 번 이상 나타나면 audit-recorder idempotent write가
 * 깨졌다는 의미.
 */
export function assertSingleDecisionPerCyclePass(
  decisions: readonly AnyDecision[],
): void {
  const seen = new Set<string>();
  for (const d of decisions) {
    const key = `${d.cycleId}::${d.pass}`;
    ok(!seen.has(key), `duplicate decision row: ${key}`);
    seen.add(key);
  }
}
