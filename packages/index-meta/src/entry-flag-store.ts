/**
 * EntryFlagStore — entry 수준 활성화 상태 영속 레이어
 *
 * MetaRegistry.entryFlags (in-memory)를 SQL로 내리는 인터페이스.
 * append-only: setFlag는 새 row를 추가한다. 현재 상태 = 가장 최신 row.
 * DB를 source of truth로 삼으면 서비스 재시작 시 코드 재구성 없이 상태 복원 가능.
 */

import type { EntityId } from "./types.js";

export interface EntryFlagRecord {
  readonly prefix:    string;
  readonly versionId: string;
  readonly position:  number;    // 1-based
  readonly status:    "active" | "inactive";
  readonly reason?:   string;
  readonly updatedAt: string;    // ISO 8601
}

export interface EntryFlagStore {
  /**
   * entry 상태 변경 기록. append-only — 같은 position에 여러 row 허용.
   * 현재 상태 = updatedAt 기준 최신 row.
   */
  setFlag(record: EntryFlagRecord): Promise<void>;

  /**
   * 특정 position의 현재 상태.
   * null = 기록 없음 (= active, 기본값).
   */
  getFlag(prefix: string, versionId: string, position: number): Promise<EntryFlagRecord | null>;

  /**
   * 버전 전체의 현재 flags (position별 최신 row).
   * inactive만 필터링하는 것이 아니라 모든 recorded position의 최신 상태.
   */
  getFlags(prefix: string, versionId: string): Promise<EntryFlagRecord[]>;

  /**
   * 버전 전체의 inactive position 목록.
   * address_state_cache의 specs 계산 입력에 사용한다.
   */
  getInactivePositions(prefix: string, versionId: string): Promise<number[]>;
}
