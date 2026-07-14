// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * named-policy.ts — entity name 기반 정책 규칙 인터페이스.
 *
 * 기존 PolicyRule(position 기반 CoordConstraint[])의 상위 레이어.
 * 사용자는 entity name과 명시적 와일드카드("*")로 규칙을 정의하고,
 * 내부에서 MetaCodec을 통해 CoordConstraint[]로 변환한다.
 *
 * 핵심 규칙:
 *   1. 모든 dim은 match에 명시적으로 선언해야 한다 (암묵적 와일드카드 금지)
 *   2. 와일드카드는 "*" 문자열로 명시
 *   3. 복수 entry는 배열로 지정
 */

import type { CoordConstraint } from 'weighted-index';
import type { MetaCodec } from './meta-codec.js';
import type { EntityId } from './types.js';
import type {
  PatternRule,
  ConflictStrategy,
  ResolveResult,
  ConflictReport,
} from './policy-resolver.js';
import {
  resolvePolicy as resolvePatternPolicy,
  detectConflicts as detectPatternConflicts,
} from './policy-resolver.js';
import { ValidationError } from './errors.js';

// ── 와일드카드 상수 ─────────────────────────────────────

/** 명시적 와일드카드. 해당 dim의 모든 entry에 매칭. */
export const WILDCARD = '*' as const;

// ── PolicyRule ─────────────────────────────────────

/** dim별 매칭 조건. 모든 dim을 명시적으로 선언해야 한다. */
export type MatchSpec = Record<string, EntityId | readonly EntityId[] | typeof WILDCARD>;

/**
 * entity name 기반 정책 규칙.
 *
 * @example
 * ```ts
 * // "admin은 모든 action에서 allow"
 * { id: "r1", match: { role: "admin", action: "*", resource: "*" }, value: "allow" }
 *
 * // "viewer는 read만 allow"
 * { id: "r2", match: { role: "viewer", action: "read", resource: "*" }, value: "allow" }
 *
 * // "editor는 read, write만 allow"
 * { id: "r3", match: { role: "editor", action: ["read", "write"], resource: "*" }, value: "allow" }
 * ```
 */
export interface PolicyRule<T> {
  readonly id: string;
  readonly match: MatchSpec;
  readonly value: T;
  readonly priority?: number;
}

// ── 변환 함수 ───────────────────────────────────────────

/**
 * MatchSpec → CoordConstraint[] 변환.
 *
 * 모든 dim이 match에 존재하는지 검증한다. 누락 시 에러.
 *
 * @throws {ValidationError} dim 누락 또는 unknown dim
 * @throws {ValidationError} entity name이 해당 dim에 없을 때
 */
export function matchToConstraints(codec: MetaCodec, match: MatchSpec): CoordConstraint[] {
  const dimIds = codec.dimIds;

  // 누락 dim 검증
  for (const dimId of dimIds) {
    if (!(dimId in match)) {
      throw new ValidationError(
        `match에 dim "${dimId}" 누락 — 와일드카드는 "${dimId}": "*"로 명시`,
      );
    }
  }

  // unknown dim 검증
  const dimIdSet = new Set(dimIds);
  for (const key of Object.keys(match)) {
    if (!dimIdSet.has(key)) {
      throw new ValidationError(`match에 unknown dim "${key}" — 유효 dim: [${dimIds.join(', ')}]`);
    }
  }

  return dimIds.map((dimId) => {
    const spec = match[dimId];

    if (spec === WILDCARD) return null;

    if (Array.isArray(spec)) {
      // 복수 entry → position 목록
      const positions = (spec as readonly EntityId[]).map((entry) =>
        resolvePosition(codec, dimId, entry),
      );
      return positions.join(',');
    }

    // 단일 entry → 단일 position
    return String(resolvePosition(codec, dimId, spec as EntityId));
  });
}

/**
 * entity name 기반 좌표를 1-based position 배열로 변환.
 *
 * @throws {ValidationError} dim 누락 (match와 같은 검증)
 * @throws {ValidationError} entity name이 해당 dim에 없을 때
 */
export function entitiesToCoord(codec: MetaCodec, entities: Record<string, EntityId>): number[] {
  const dimIds = codec.dimIds;

  for (const dimId of dimIds) {
    if (!(dimId in entities)) {
      throw new ValidationError(`entities에 dim "${dimId}" 누락`);
    }
  }

  return dimIds.map((dimId) => resolvePosition(codec, dimId, entities[dimId]));
}

/**
 * PolicyRule(match 기반) → PatternRule(position 기반) 변환. 내부 엔진 호출용.
 */
export function ruleToPattern<T>(codec: MetaCodec, rule: PolicyRule<T>): PatternRule<T> {
  return {
    id: rule.id,
    pattern: matchToConstraints(codec, rule.match),
    value: rule.value,
    priority: rule.priority,
  };
}

// ── 고수준 API ──────────────────────────────────────────

/**
 * entity name 기반 정책 해소.
 *
 * @param codec      대상 index의 MetaCodec
 * @param entities   조회할 좌표 (모든 dim 필수)
 * @param rules      PolicyRule 목록
 * @param strategy   충돌 해소 전략
 *
 * @example
 * ```ts
 * const codec = engine.codec("perm", "v1");
 *
 * const rules: PolicyRule<string>[] = [
 *   { id: "default", match: { role: "*", action: "*", resource: "*" }, value: "deny" },
 *   { id: "admin",   match: { role: "admin", action: "*", resource: "*" }, value: "allow" },
 *   { id: "read",    match: { role: "*", action: "read", resource: "*" }, value: "allow" },
 * ];
 *
 * resolvePolicy(codec, { role: "editor", action: "read", resource: "dashboard" }, rules, "most-specific");
 * // → { value: "allow", matchedRules: [read(구체성1), default(구체성0)] }
 *
 * resolvePolicy(codec, { role: "editor", action: "write", resource: "settings" }, rules, "most-specific");
 * // → { value: "deny", matchedRules: [default(구체성0)] }
 *
 * resolvePolicy(codec, { role: "admin", action: "delete", resource: "users" }, rules, "most-specific");
 * // → { value: "allow", matchedRules: [admin(구체성1), default(구체성0)] }
 * ```
 */
export function resolvePolicy<T>(
  codec: MetaCodec,
  entities: Record<string, EntityId>,
  rules: readonly PolicyRule<T>[],
  strategy: ConflictStrategy,
): ResolveResult<T> | null {
  const coord = entitiesToCoord(codec, entities);
  const shape = [...codec.shape];
  const policyRules = rules.map((r) => ruleToPattern(codec, r));

  return resolvePatternPolicy(coord, policyRules, shape, strategy);
}

/**
 * entity name 기반 충돌 탐지.
 */
export function detectConflicts<T>(
  codec: MetaCodec,
  rules: readonly PolicyRule<T>[],
  eq?: (a: T, b: T) => boolean,
): ConflictReport<T>[] {
  const shape = [...codec.shape];
  const policyRules = rules.map((r) => ruleToPattern(codec, r));
  return detectPatternConflicts(policyRules, shape, eq);
}

// ── 내부 헬퍼 ───────────────────────────────────────────

function resolvePosition(codec: MetaCodec, dimId: string, entry: EntityId): number {
  const dim = codec.getDimInfo(dimId);
  if (!dim) {
    throw new ValidationError(`unknown dim "${dimId}"`);
  }

  const idx = dim.entries.indexOf(entry);
  if (idx === -1) {
    throw new ValidationError(
      `dim "${dimId}"에 entry "${entry}" 없음 — 유효: [${dim.entries.slice(0, 8).join(', ')}${dim.entries.length > 8 ? ', ...' : ''}]`,
    );
  }

  return idx + 1; // 1-based
}
