/* ------------------------------------------------------------------ */
/*  AddressIndex — 주소 역색인 포트                                     */
/* ------------------------------------------------------------------ */

import type {
  AddressQuery,
  AddressHit,
  AddressStats,
  CrossPrefixQuery,
} from "./types.js";

export interface AddressIndex {
  /**
   * 레코드의 address_context를 인덱싱
   * ingest 시점에 호출 — 기존 저장소와 병렬로 동작
   */
  index(
    recordId: string,
    addressContext: Record<string, string>,
    timestamp: string,
  ): Promise<void>;

  /** 단일 prefix 주소 조회 (정확 매치 또는 범위) */
  find(query: AddressQuery): Promise<AddressHit[]>;

  /** 다중 prefix 교차 조회 (AND 결합) */
  findCross(query: CrossPrefixQuery): Promise<AddressHit[]>;

  /** 특정 레코드의 인덱싱된 주소 조회 */
  getAddresses(
    recordId: string,
  ): Promise<Record<string, { version: string; address: number }> | null>;

  /** prefix별 통계 */
  stats(prefixId?: string): Promise<AddressStats[]>;

  /** 인덱스된 전체 레코드 수 */
  count(): Promise<number>;

  /** 인덱스 초기화 */
  clear(): Promise<void>;
}
