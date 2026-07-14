// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * AddressStateStore — 1D 주소 공간 활성화 상태 캐시
 *
 * dim별 상태 명세(DimStateSpec[])와 precomputed 구간을 저장한다.
 * 캐시이므로 언제든 삭제 후 재계산 가능.
 */

import type { DimStateSpec } from './invalid-ranges.js';

// ── 저장 타입 ─────────────────────────────────────────────

export interface AddressStateCacheRecord {
  readonly prefix: string;
  readonly versionId: string;
  /** dim별 상태 명세 (재계산·감사 로그용) */
  readonly specs: readonly DimStateSpec[];
  /** encode ✗, decode ✗ */
  readonly reservedRanges: readonly [number, number][];
  /** encode ✗, decode ✓ */
  readonly inactiveRanges: readonly [number, number][];
  /** encode ✓, decode ✗ */
  readonly openRanges: readonly [number, number][];
  readonly computedAt: string;
}

// ── 인터페이스 ────────────────────────────────────────────

export interface AddressStateStore {
  /**
   * 상태 캐시 저장. 이미 존재하면 덮어쓴다.
   */
  save(record: AddressStateCacheRecord): Promise<void>;

  /**
   * 저장된 캐시 조회.
   * null = 아직 계산 안 됨 (= 전체 active).
   */
  get(prefix: string, versionId: string): Promise<AddressStateCacheRecord | null>;

  /**
   * 캐시 삭제 (상태 변경 후 재계산 필요 시).
   */
  delete(prefix: string, versionId: string): Promise<void>;
}
