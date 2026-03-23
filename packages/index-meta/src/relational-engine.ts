/**
 * relational-engine.ts — 관계형 엔진 facade
 *
 * policy-resolver + cross-index-query + MetaRegistry를 통합하여
 * 관계 유형 정의, 2-level 규칙 매칭, cross-index 범위 합성을
 * 하나의 진입점으로 제공한다.
 *
 * 설계: docs/relational-engine.md
 */

import type { CoordConstraint, EntityId } from "weighted-index";
import { calcAddressRanges, containsAddress } from "weighted-index";
import { MetaRegistry } from "./meta-registry.js";
import { MetaCodec } from "./meta-codec.js";
import type { MetaRegistryInput, VersionedValue } from "./types.js";
import {
  matchRules,
  resolvePolicy,
  detectConflicts,
  type PatternRule,
  type ConflictStrategy,
  type ResolveResult,
  type ConflictReport,
} from "./policy-resolver.js";
import { composeQuery, deepDecode, type DeepDecodeResult } from "./cross-index-query.js";

// ── Types ────────────────────────────────────────────────────────────────────

/**
 * 2-level rule engine의 type-level 규칙.
 *
 * 관계 유형 좌표 공간(subject_kind × predicate × object_kind)에서 매칭되며,
 * instanceRules가 있으면 인스턴스 레벨로 drill-down한다.
 */
export interface RelationTypeRule<T> {
  id: string;
  pattern: CoordConstraint[];
  /** type-level 효과. instanceRules가 없으면 이 값이 최종 */
  effect: T;
  /** 인스턴스 레벨 규칙. 있으면 2nd level 매칭 수행 */
  instanceRules?: {
    indexId: string;
    versionId: string;
    rules: PatternRule<T>[];
    strategy: ConflictStrategy;
  };
  priority?: number;
}

/** 2-level rule engine 실행 결과 */
export interface RelationResolveResult<T> {
  /** 최종 결정된 값 */
  value: T;
  /** type-level 매칭 결과 */
  typeLevel: ResolveResult<T>;
  /** instance-level 매칭 결과 (2nd level을 거친 경우) */
  instanceLevel?: ResolveResult<T> | null;
}

// ── RelationalEngine ─────────────────────────────────────────────────────────

/**
 * 관계형 엔진 facade.
 *
 * 관계 유형을 1D 인코딩하고, 좌표 공간에서 규칙을 매칭하며,
 * cross-index 범위 합성과 깊은 디코딩을 제공한다.
 */
export class RelationalEngine {
  readonly registry: MetaRegistry;

  constructor(input: MetaRegistryInput) {
    this.registry = new MetaRegistry(input);
  }

  // ── codec 접근 ──

  /** 특정 index + version에 대한 MetaCodec 생성 (캐싱은 MetaRegistry 내부) */
  codec(indexId: string, versionId: string): MetaCodec {
    return this.registry.createCodec(indexId, versionId);
  }

  /** entity names → VersionedValue */
  encode(
    indexId: string,
    versionId: string,
    entities: Record<string, EntityId>,
  ): VersionedValue {
    return this.codec(indexId, versionId).encode(entities);
  }

  /** VersionedValue → entity names */
  decode(
    indexId: string,
    versionId: string,
    vv: VersionedValue,
  ): Readonly<Record<string, EntityId>> {
    return this.codec(indexId, versionId).decode(vv);
  }

  // ── 범위 쿼리 ──

  /** 부분 매칭으로 주소 범위 계산 */
  matchRanges(
    indexId: string,
    versionId: string,
    partial: Record<string, EntityId | null>,
  ): [number, number][] {
    return this.codec(indexId, versionId).matchRanges(partial);
  }

  /** 좌표 제약 조건으로 주소 범위 계산 */
  addressRanges(
    indexId: string,
    versionId: string,
    constraints: CoordConstraint[],
  ): [number, number][] {
    const wi = this.registry.getWeightedIndex(indexId, versionId);
    return calcAddressRanges(wi.shape, constraints);
  }

  /** 주소가 범위 내에 있는지 O(log n) 판정 */
  contains(value: number, ranges: [number, number][]): boolean {
    return containsAddress(value, ranges);
  }

  // ── cross-index 합성 질의 ──

  /** index_ref dim을 통한 cross-index 범위 합성 */
  composeQuery(
    source: { indexId: string; versionId: string },
    through: string,
    targetConstraint: Record<string, EntityId | null>,
  ): [number, number][] {
    return composeQuery(source, through, targetConstraint, this.registry);
  }

  /** index_ref 체인 끝까지 재귀 디코딩 */
  deepDecode(address: VersionedValue, maxDepth?: number): DeepDecodeResult {
    return deepDecode(address, this.registry, maxDepth);
  }

  // ── 규칙 매칭 (single-level) ──

  /** 좌표에 매칭되는 모든 규칙을 구체성 내림차순으로 반환 */
  matchRules<T>(
    coord: readonly number[],
    rules: readonly PatternRule<T>[],
    shape: readonly number[],
  ): PatternRule<T>[] {
    return matchRules(coord, rules, shape);
  }

  /** 전략에 따라 최종 값 결정 */
  resolvePolicy<T>(
    coord: readonly number[],
    rules: readonly PatternRule<T>[],
    shape: readonly number[],
    strategy: ConflictStrategy,
  ): ResolveResult<T> | null {
    return resolvePolicy(coord, rules, shape, strategy);
  }

  /** 규칙 간 충돌 탐지 */
  detectConflicts<T>(
    rules: readonly PatternRule<T>[],
    shape: readonly number[],
    eq?: (a: T, b: T) => boolean,
  ): ConflictReport<T>[] {
    return detectConflicts(rules, shape, eq);
  }

  // ── 2-level rule engine ──

  /**
   * 2-level 규칙 매칭.
   *
   * Level 1: 관계 유형 좌표에서 type-level 규칙 매칭
   * Level 2: 매칭된 규칙에 instanceRules가 있으면, 해당 instance index에서 재매칭
   *
   * @param relTypeCoord  관계 유형 좌표 (1-based)
   * @param relShape      관계 유형 index의 shape
   * @param typeRules     type-level 규칙 목록
   * @param typeStrategy  type-level 충돌 해소 전략
   * @param instanceCoord instance 좌표 (2nd level 매칭에 사용). 없으면 type-level만 수행.
   */
  resolveRelation<T>(
    relTypeCoord: readonly number[],
    relShape: readonly number[],
    typeRules: readonly RelationTypeRule<T>[],
    typeStrategy: ConflictStrategy,
    instanceCoord?: readonly number[],
  ): RelationResolveResult<T> | null {
    // Level 1: type-level 매칭
    const typePatternRules: PatternRule<T>[] = typeRules.map((r) => ({
      id: r.id,
      pattern: r.pattern,
      value: r.effect,
      priority: r.priority,
    }));

    const typeResult = resolvePolicy(relTypeCoord, typePatternRules, relShape, typeStrategy);
    if (!typeResult) return null;

    // type-level에서 매칭된 원본 규칙 찾기
    const matchedTypeRule = typeRules.find((r) => r.id === typeResult.matchedRules[0].id);

    // Level 2: instance-level 매칭 (조건 충족 시)
    if (matchedTypeRule?.instanceRules && instanceCoord) {
      const { indexId, versionId, rules: instRules, strategy: instStrategy } = matchedTypeRule.instanceRules;
      const instWi = this.registry.getWeightedIndex(indexId, versionId);

      const instResult = resolvePolicy(instanceCoord, instRules, instWi.shape, instStrategy);

      return {
        value: instResult ? instResult.value as T : typeResult.value as T,
        typeLevel: typeResult,
        instanceLevel: instResult,
      };
    }

    return {
      value: typeResult.value as T,
      typeLevel: typeResult,
    };
  }
}
