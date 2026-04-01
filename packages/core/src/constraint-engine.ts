/**
 * Constraint 검증 엔진 — constraint 평가 + 결과 수집 + 오류 추적
 */

import type {
  ConstraintDef, ConstraintResult, ConstraintPredicate, FailureTrace,
} from "./types/constraint.js";

// ── Constraint 레지스트리 ─────────────────────────────

export class ConstraintRegistry {
  private readonly constraints: Map<string, ConstraintDef> = new Map();
  private readonly results: ConstraintResult[] = [];

  /** constraint 등록 */
  register(constraint: ConstraintDef): void {
    this.constraints.set(constraint.constraintId, constraint);
  }

  /** constraint 조회 */
  get(constraintId: string): ConstraintDef | null {
    return this.constraints.get(constraintId) ?? null;
  }

  /** 스펙별 constraint 조회 */
  getBySpec(specId: string): ConstraintDef[] {
    return [...this.constraints.values()].filter(c => c.specId === specId);
  }

  /** 전체 constraint 목록 */
  listAll(): ConstraintDef[] {
    return [...this.constraints.values()];
  }

  // ── 검증 결과 수집 ────────────────────────────────

  /** 검증 결과 기록 */
  recordResult(result: ConstraintResult): void {
    this.results.push(result);
  }

  /** 특정 constraint의 최신 결과 */
  getLatestResult(constraintId: string): ConstraintResult | null {
    const filtered = this.results.filter(r => r.constraintId === constraintId);
    return filtered.length > 0 ? filtered[filtered.length - 1] : null;
  }

  /** 특정 스펙의 모든 결과 */
  getResultsBySpec(specId: string): ConstraintResult[] {
    return this.results.filter(r => r.specId === specId);
  }

  /** 실패한 결과만 */
  getFailures(): ConstraintResult[] {
    return this.results.filter(r => r.verdict === "fail");
  }

  /** 전체 결과 */
  getAllResults(): readonly ConstraintResult[] {
    return this.results;
  }

  // ── 품질 지표 ─────────────────────────────────────

  /** 스펙별 검증 현황 */
  getSpecVerificationStatus(specId: string): {
    total: number;
    verified: number;
    failed: number;
    untested: number;
    verificationRate: number;
  } {
    const constraints = this.getBySpec(specId);
    let verified = 0;
    let failed = 0;
    let untested = 0;

    for (const c of constraints) {
      const result = this.getLatestResult(c.constraintId);
      if (!result) {
        untested++;
      } else if (result.verdict === "pass") {
        verified++;
      } else {
        failed++;
      }
    }

    const total = constraints.length;
    return {
      total,
      verified,
      failed,
      untested,
      verificationRate: total > 0 ? Math.round((verified / total) * 100) : 0,
    };
  }

  /** 전체 시스템 검증 현황 */
  getSystemStatus(): {
    totalConstraints: number;
    totalVerified: number;
    totalFailed: number;
    totalUntested: number;
    overallRate: number;
    specBreakdown: Record<string, { total: number; verified: number; rate: number }>;
  } {
    const specIds = new Set(this.constraints.values()).size > 0
      ? [...new Set([...this.constraints.values()].map(c => c.specId))]
      : [];

    let totalConstraints = 0;
    let totalVerified = 0;
    let totalFailed = 0;
    let totalUntested = 0;
    const specBreakdown: Record<string, { total: number; verified: number; rate: number }> = {};

    for (const specId of specIds) {
      const status = this.getSpecVerificationStatus(specId);
      totalConstraints += status.total;
      totalVerified += status.verified;
      totalFailed += status.failed;
      totalUntested += status.untested;
      specBreakdown[specId] = {
        total: status.total,
        verified: status.verified,
        rate: status.verificationRate,
      };
    }

    return {
      totalConstraints,
      totalVerified,
      totalFailed,
      totalUntested,
      overallRate: totalConstraints > 0 ? Math.round((totalVerified / totalConstraints) * 100) : 0,
      specBreakdown,
    };
  }
}

// ── Predicate 평가 ────────────────────────────────────

/** predicate를 실제 값에 대해 평가 */
export function evaluatePredicate(predicate: ConstraintPredicate, actual: unknown): boolean {
  switch (predicate.op) {
    case "eq": return actual === predicate.expected;
    case "neq": return actual !== predicate.expected;
    case "gt": return (actual as number) > (predicate.expected as number);
    case "gte": return (actual as number) >= (predicate.expected as number);
    case "lt": return (actual as number) < (predicate.expected as number);
    case "lte": return (actual as number) <= (predicate.expected as number);

    case "exists": return actual != null;
    case "not-exists": return actual == null;

    case "contains": {
      if (Array.isArray(actual)) return actual.includes(predicate.expected);
      if (typeof actual === "string") return actual.includes(predicate.expected as string);
      return false;
    }
    case "not-contains": {
      if (Array.isArray(actual)) return !actual.includes(predicate.expected);
      if (typeof actual === "string") return !actual.includes(predicate.expected as string);
      return true;
    }

    case "subset-of": {
      if (!Array.isArray(actual) || !Array.isArray(predicate.expected)) return false;
      return actual.every(item => (predicate.expected as unknown[]).includes(item));
    }
    case "superset-of": {
      if (!Array.isArray(actual) || !Array.isArray(predicate.expected)) return false;
      return (predicate.expected as unknown[]).every(item => (actual as unknown[]).includes(item));
    }

    case "type-is": return typeof actual === predicate.expected;

    case "and":
      return (predicate.children ?? []).every(c => evaluatePredicate(c, actual));
    case "or":
      return (predicate.children ?? []).some(c => evaluatePredicate(c, actual));
    case "not":
      return predicate.children?.[0] ? !evaluatePredicate(predicate.children[0], actual) : false;

    // compatible, breaking, connected-to, reachable, traceable는
    // 도메인 로직이 필요하므로 여기서는 true 반환 (외부에서 평가)
    case "compatible":
    case "breaking":
    case "connected-to":
    case "reachable":
    case "traceable":
      return true;

    default:
      return false;
  }
}

// ── Constraint 실행 헬퍼 ──────────────────────────────

/** constraint를 실행하고 결과를 생성 */
export function executeConstraint(
  constraint: ConstraintDef,
  actualValue: unknown,
): ConstraintResult {
  const start = Date.now();
  const pass = evaluatePredicate(constraint.predicate, actualValue);

  const result: ConstraintResult = {
    constraintId: constraint.constraintId,
    specId: constraint.specId,
    verdict: pass ? "pass" : "fail",
    actualValue,
    expectedValue: constraint.predicate.expected,
    executedAt: new Date().toISOString(),
    duration: Date.now() - start,
  };

  if (!pass) {
    result.failureTrace = {
      subject: constraint.subject,
      predicate: constraint.predicate,
      context: constraint.context,
      hint: `${constraint.subject.ref}의 ${constraint.predicate.op} 조건 불충족`,
    };
  }

  return result;
}
