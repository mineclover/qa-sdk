/**
 * AddressRangeCache — calcAddressRanges 결과의 범용 사전 계산 캐시
 *
 * ── 목적 ───────────────────────────────────────────────────────────────────
 *
 * calcAddressRanges의 비연속 OR 조합이 고차원에서 급격히 느려진다
 * (예: 6D 복합 OR → ~900 ops/s). 사전 계산 + O(log n) binary search
 * 패턴으로 해결한다:
 *
 * 1. 빌드 타임: calcAddressRanges(shape, constraints) → [number, number][]
 * 2. 저장: AddressRangeCache.save({ prefix, versionId, label, ranges })
 * 3. 런타임: containsAddress(address, cachedRanges) → O(log n)
 *
 * ── AddressStateStore와의 관계 ──────────────────────────────────────────
 *
 * AddressStateStore는 게이트 제어 전용 (reserved/inactive/open 3-set 고정).
 * AddressRangeCache는 범용: 임의의 label로 다수의 range set을 저장한다.
 *
 * 관계 유형 rule engine, cross-index 쿼리 캐시, 정책 매칭 사전 계산 등
 * calcAddressRanges 결과를 재사용하는 모든 패턴에 사용한다.
 *
 * ── 사용 예 ────────────────────────────────────────────────────────────────
 *
 * ```ts
 * import { calcAddressRanges, containsAddress } from "weighted-index";
 *
 * // 빌드 타임: 사전 계산
 * const ranges = calcAddressRanges(shape, ["2", null, "1,3,5", null, null, "2-4"]);
 * await cache.save({
 *   prefix: "perm", versionId: "v1",
 *   label: "role=editor&resource=1,3,5&env=2-4",
 *   ranges,
 *   constraints: ["2", null, "1,3,5", null, null, "2-4"],
 *   computedAt: new Date().toISOString(),
 * });
 *
 * // 런타임: O(log n) 조회
 * const cached = await cache.get("perm", "v1", "role=editor&resource=1,3,5&env=2-4");
 * if (cached && containsAddress(address, cached.ranges)) {
 *   // 매칭됨
 * }
 * ```
 */

import type { CoordConstraint } from "weighted-index";

// ── 저장 타입 ─────────────────────────────────────────────

export interface RangeCacheRecord {
  readonly prefix: string;
  readonly versionId: string;
  /** 캐시 키. 의미 있는 이름 권장 (예: "role=admin", "user_can_access_*") */
  readonly label: string;
  /** 사전 계산된 address range 배열. sorted, merged. */
  readonly ranges: readonly [number, number][];
  /** 원본 constraint 패턴 (재계산·디버깅용, 선택) */
  readonly constraints?: readonly CoordConstraint[];
  readonly computedAt: string;
}

// ── 인터페이스 ────────────────────────────────────────────

export interface AddressRangeCache {
  /**
   * range 캐시 저장. 이미 존재하면 덮어쓴다.
   */
  save(record: RangeCacheRecord): Promise<void>;

  /**
   * 특정 캐시 항목 조회.
   * null = 아직 계산 안 됨.
   */
  get(prefix: string, versionId: string, label: string): Promise<RangeCacheRecord | null>;

  /**
   * 특정 (prefix, versionId) 하위의 모든 캐시 목록 조회.
   * 스키마 변경 시 일괄 무효화 판단에 사용.
   */
  list(prefix: string, versionId: string): Promise<RangeCacheRecord[]>;

  /**
   * 특정 캐시 항목 삭제.
   */
  delete(prefix: string, versionId: string, label: string): Promise<void>;

  /**
   * 특정 (prefix, versionId)의 모든 캐시 삭제.
   * 스키마 변경 시 해당 버전의 캐시 일괄 무효화에 사용.
   */
  deleteAll(prefix: string, versionId: string): Promise<void>;
}
