/**
 * policy-resolver.ts — 좌표 공간 위의 규칙 매칭과 충돌 해소.
 *
 * Pattern Lattice(weighted-index/calc.ts) 위에서 동작한다.
 * 여러 규칙이 겹치는 좌표에 대해 ConflictStrategy로 최종 값을 결정한다.
 */
import type { CoordConstraint } from "weighted-index";
import {
  coordMatchesPattern,
  patternSpecificity,
  patternMeet,
} from "weighted-index";

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * 좌표 공간에서 특정 패턴에 값을 할당하는 규칙.
 */
export interface PolicyRule<T> {
  /** 규칙 식별자 */
  id: string;
  /** 이 규칙이 적용되는 좌표 범위 (CoordConstraint 배열 = 패턴) */
  pattern: CoordConstraint[];
  /** 규칙이 주장하는 값 */
  value: T;
  /** 명시적 우선순위 (높을수록 우선). 'priority' 전략에서 사용 */
  priority?: number;
}

/**
 * 충돌 해소 전략.
 *
 * - 'most-specific': patternSpecificity가 가장 높은 패턴 승리
 * - 'priority':      명시적 priority 기준 (내림차순)
 * - 'collect':       매칭되는 모든 값 수집 (배열 반환)
 * - 'first-match':   입력 순서 기준 첫 매칭
 */
export type ConflictStrategy =
  | "most-specific"
  | "priority"
  | "collect"
  | "first-match";

/**
 * resolvePolicy의 반환값.
 */
export interface ResolveResult<T> {
  /** 전략에 따라 결정된 값. 'collect' 전략이면 T[] */
  value: T | T[];
  /** 매칭된 규칙 목록 (구체성 내림차순) */
  matchedRules: PolicyRule<T>[];
  /** 사용된 전략 */
  strategy: ConflictStrategy;
}

/**
 * 충돌 탐지 보고.
 */
export interface ConflictReport<T> {
  /** 충돌이 발생하는 좌표 범위 (두 패턴의 교집합) */
  overlapPattern: CoordConstraint[];
  /** 겹치는 규칙들 */
  conflictingRules: PolicyRule<T>[];
}

// ── Core Functions ───────────────────────────────────────────────────────────

/**
 * 좌표에 매칭되는 모든 규칙을 구체성 내림차순으로 반환한다.
 *
 * @param coord  1-based 좌표
 * @param rules  규칙 목록
 * @param shape  각 차원의 크기
 */
export function matchRules<T>(
  coord: readonly number[],
  rules: readonly PolicyRule<T>[],
  shape: readonly number[],
): PolicyRule<T>[] {
  const matched = rules.filter((r) =>
    coordMatchesPattern(coord, r.pattern, shape),
  );
  return matched.sort(
    (a, b) =>
      patternSpecificity(b.pattern, shape) -
      patternSpecificity(a.pattern, shape),
  );
}

/**
 * 좌표에 대해 전략에 따라 최종 값을 결정한다.
 * 매칭되는 규칙이 없으면 null.
 */
export function resolvePolicy<T>(
  coord: readonly number[],
  rules: readonly PolicyRule<T>[],
  shape: readonly number[],
  strategy: ConflictStrategy,
): ResolveResult<T> | null {
  const matched = matchRules(coord, rules, shape);
  if (matched.length === 0) return null;

  switch (strategy) {
    case "most-specific":
      return {
        value: matched[0].value,
        matchedRules: matched,
        strategy,
      };

    case "priority": {
      const sorted = [...matched].sort(
        (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
      );
      return {
        value: sorted[0].value,
        matchedRules: sorted,
        strategy,
      };
    }

    case "collect":
      return {
        value: matched.map((r) => r.value),
        matchedRules: matched,
        strategy,
      };

    case "first-match": {
      // 원래 입력 순서에서 첫 번째 매칭을 찾는다
      const first = rules.find((r) =>
        coordMatchesPattern(coord, r.pattern, shape),
      )!;
      return {
        value: first.value,
        matchedRules: matched,
        strategy,
      };
    }
  }
}

/**
 * 동일 좌표 범위에서 다른 값을 주장하는 규칙 쌍을 탐지한다.
 *
 * O(N² × ndims) — 빌드 타임 사전 검증용.
 *
 * @param eq  값 동등성 비교 함수. 기본값: ===
 */
export function detectConflicts<T>(
  rules: readonly PolicyRule<T>[],
  shape: readonly number[],
  eq: (a: T, b: T) => boolean = (a, b) => a === b,
): ConflictReport<T>[] {
  const conflicts: ConflictReport<T>[] = [];

  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const overlap = patternMeet(rules[i].pattern, rules[j].pattern, shape);
      if (overlap !== null && !eq(rules[i].value, rules[j].value)) {
        conflicts.push({
          overlapPattern: overlap,
          conflictingRules: [rules[i], rules[j]],
        });
      }
    }
  }

  return conflicts;
}
