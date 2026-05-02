// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

/**
 * 쿼리 결과 캐시 포트.
 *
 * packed_key → 디코딩 결과를 캐시하여 hot path O(1) lookup을 제공한다.
 * TTL 기반으로 자동 만료하며, 구현체에 따라 L1(in-process), L2(Redis/KV)로 확장 가능.
 */

/** 캐시 항목 메타데이터 */
export interface CacheEntry<T> {
  readonly value: T;
  readonly cachedAt: number;
  readonly ttlMs: number;
}

/** 캐시 통계 */
export interface CacheStats {
  readonly size: number;
  readonly hits: number;
  readonly misses: number;
  readonly evictions: number;
}

export interface KeyCache<T = unknown> {
  /** 키로 캐시된 값 조회. 만료 시 undefined */
  get(key: string): Promise<T | undefined>;

  /** 값 저장. ttlMs가 0이면 영구 캐시 */
  set(key: string, value: T, ttlMs: number): Promise<void>;

  /** 단건 삭제 */
  delete(key: string): Promise<boolean>;

  /** 전체 삭제 */
  clear(): Promise<void>;

  /** 키 존재 여부 (만료 포함) */
  has(key: string): Promise<boolean>;

  /** 캐시 통계 */
  stats(): CacheStats;
}
