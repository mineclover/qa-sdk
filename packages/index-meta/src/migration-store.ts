/**
 * MigrationStore — 버전 간 변경 이력 저장소 (PositionEngine)
 *
 * Position은 버전을 초월해 안정적이므로 주소 재매핑은 없다.
 * 추적 대상: EntityId 수정, 비활성화.
 *
 * 금지: position 순서 변경 (moved), 완전 삭제 (removed).
 */

import type { EntityId } from "./types.js";

// ── 타입 ──────────────────────────────────────────────────

export type MigrationChangeType = "modified" | "deactivated";

export interface MigrationMapping {
  readonly fromVersionId: string;
  readonly toVersionId: string;
  readonly position: number;
  readonly changeType: MigrationChangeType;
  readonly oldEntityId: EntityId | null;
  readonly newEntityId: EntityId | null;
  readonly createdAt: string;
}

export interface MigrationResolveResult {
  readonly currentVersionId: string;
  readonly currentEntityId: EntityId | null;
  readonly chain: readonly MigrationMapping[];
}

// ── 인터페이스 ────────────────────────────────────────────

export interface MigrationStore {
  /** 매핑 일괄 저장 (release 시). */
  saveMappings(prefix: string, mappings: readonly MigrationMapping[]): Promise<void>;

  /** 특정 position의 변경 이력 조회. */
  getHistory(prefix: string, position: number): Promise<MigrationMapping[]>;

  /** 버전 간 전체 변경 조회. */
  getMappings(
    prefix: string,
    fromVersionId: string,
    toVersionId: string,
  ): Promise<MigrationMapping[]>;

  /** position의 현재 상태까지 체이닝. */
  resolveToLatest(
    prefix: string,
    fromVersionId: string,
    position: number,
    latestVersionId: string,
  ): Promise<MigrationResolveResult>;
}
