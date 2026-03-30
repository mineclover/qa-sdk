/**
 * VersionLifecycleStore — 버전 상태 관리 (PositionEngine)
 *
 * EntryLifecycle: draft → released → active → deprecated
 *
 * - draft: 변경 계획 중 (entry 수정/비활성화 가능)
 * - released: 확정됨 (entry append만 가능)
 * - active: 현재 권장 버전 (prefix당 1개)
 * - deprecated: 읽기 전용 (decode만 가능)
 *
 * ── 비활성화 모드 (DeactivationMode) ──────────────────────
 *
 * prefix 단위 설정. 모든 버전이 동일한 모드를 공유한다.
 *
 * strict:   비활성화/재활성화는 draft→release 사이클에서만 허용.
 *           모든 변경이 MigrationStore에 불변 이력으로 남음.
 *           캐시 영구 유효 보장.
 *           용도: 권한 스키마, 계약 구조 등 감사 추적 필수 도메인.
 *
 * flexible: 런타임에 EntryFlagStore로 즉시 토글 가능.
 *           MigrationStore에는 버전 전이 시 확정 변경만 기록.
 *           flag 변경 시 AddressStateStore 재계산 필요.
 *           용도: 피처 플래그, 동적 설정, A/B 테스트.
 */

// ── 타입 ──────────────────────────────────────────────────

export type VersionStatus = "draft" | "released" | "active" | "deprecated";

/**
 * 비활성화 모드. prefix 단위로 설정, 모든 버전이 동일 모드 공유.
 *
 * - strict:   draft→release 사이클에서만 비활성화/재활성화 허용.
 * - flexible: 런타임 즉시 토글 (EntryFlagStore 기반).
 */
export type DeactivationMode = "strict" | "flexible";

export interface VersionRecord {
  readonly prefix: string;
  readonly versionId: string;
  readonly status: VersionStatus;
  readonly baseVersionId: string | null;
  readonly capacity: number;
  readonly deactivationMode: DeactivationMode;
  readonly createdAt: string;
  readonly releasedAt: string | null;
}

// ── 인터페이스 ────────────────────────────────────────────

export interface VersionLifecycleStore {
  /**
   * draft 생성 (기반 버전에서 복사).
   * deactivationMode: 최초 버전 생성 시 지정. 이후 버전은 기반 버전에서 상속.
   */
  createDraft(
    prefix: string,
    versionId: string,
    baseVersionId: string | null,
    capacity: number,
    deactivationMode?: DeactivationMode,
  ): Promise<VersionRecord>;

  /** draft를 release. 마이그레이션 매핑 확정. */
  release(prefix: string, versionId: string): Promise<void>;

  /** active 버전 교체. 이전 active → released. */
  activate(prefix: string, versionId: string): Promise<void>;

  /** deprecated 처리. encode 차단. */
  deprecate(prefix: string, versionId: string): Promise<void>;

  /** prefix의 현재 active 버전. */
  getActive(prefix: string): Promise<VersionRecord | null>;

  /** 특정 버전 조회. */
  getVersion(prefix: string, versionId: string): Promise<VersionRecord | null>;

  /** prefix의 모든 버전 (상태별 필터). */
  getVersions(prefix: string, status?: VersionStatus): Promise<VersionRecord[]>;
}
