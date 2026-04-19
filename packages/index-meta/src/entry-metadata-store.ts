// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * EntryMetadataStore — position 기반 관계형 메타데이터 (PositionEngine)
 *
 * Position이 버전을 초월해 안정적이므로 버전 컬럼 없이
 * (prefix, position, key) 로 메타데이터를 관리한다.
 *
 * n차원 index: composite address가 position 역할.
 * 1D prefix: position이 그대로 키.
 */

// ── 타입 ──────────────────────────────────────────────────

export interface MetadataEntry {
  readonly position: number;
  readonly key: string;
  readonly value: unknown;
  readonly updatedAt: string;
}

// ── 인터페이스 ────────────────────────────────────────────

export interface EntryMetadataStore {
  /** 메타데이터 설정 (upsert). */
  set(prefix: string, position: number, key: string, value: unknown): Promise<void>;

  /** 단일 메타데이터 조회. */
  get(prefix: string, position: number, key: string): Promise<unknown | null>;

  /** position의 모든 메타데이터 조회. */
  getAll(prefix: string, position: number): Promise<Record<string, unknown>>;

  /** 메타데이터 삭제. */
  delete(prefix: string, position: number, key: string): Promise<void>;

  /** prefix의 특정 key를 가진 모든 position 조회. */
  findByKey(prefix: string, key: string): Promise<Array<{ position: number; value: unknown }>>;
}
