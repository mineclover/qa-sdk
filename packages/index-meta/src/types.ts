/**
 * index-meta 공개 타입 정의
 *
 * ── 엔티티 계층 ──────────────────────────────────────────────────────────────
 *
 *  DimDef          : 차원 슬롯 정의 (kind 포함 — 들어오는 값의 형태를 선언)
 *  DimSnapshot     : 해당 차원의 특정 시점 값 목록 (entries + entryFlags)
 *  IndexDef        : 차원들의 순서 있는 조합 (= prefix 정의)
 *  IndexVersion    : IndexDef의 한 버전 스냅샷 — 각 차원의 어느 DimSnapshot을 사용하는지
 *
 * ── DimKind ──────────────────────────────────────────────────────────────────
 *
 *  string_enum  : entries가 string[]. 값 자체가 identity.
 *                 예) ["admin", "editor", "viewer"]
 *
 *  index_ref    : entries가 number[]. 각 값은 다른 WeightedIndex의 1D 압축 결과.
 *                 indexId를 명시하면 어느 IndexDef의 값인지 추적 가능.
 *                 예) [42, 87, 156]  ← document_state index의 VersionedValue.value
 *
 * ── 1D 복원 경로 ──────────────────────────────────────────────────────────────
 *
 *  VersionedValue { indexId, versionId, value }
 *    → IndexDef[indexId].dims          → [dim_0, ..., dim_n]
 *    → IndexVersion[indexId,versionId] → { dim_i: snapshotId_i }
 *    → DimSnapshot[dim_i, snapshotId_i].entries.length → N_i  (shape)
 *    → WeightedIndex(shape).decode(value) → coords
 *    → DimSnapshot[dim_i, snapshotId_i].entries[coord_i - 1] → entry value
 *       ↳ string_enum → 그대로 반환
 *       ↳ number_enum → 그대로 반환
 *       ↳ index_ref   → 반환값이 또 다른 VersionedValue.value (재귀 확장 가능)
 */

// ── DimKind ───────────────────────────────────────────────────────────────────

/**
 * string_enum : entries는 string[]. string 값 자체가 unique key.
 *
 * number_enum : entries는 number[]. number 값 자체가 unique key.
 *               다른 index와의 참조 관계 없음. 그냥 숫자를 식별자로 쓰는 경우.
 *
 * index_ref   : entries는 number[]. 값은 다른 WeightedIndex의 1D 압축 정수.
 *               indexId — 어느 index 계열의 값만 받는지 선언.
 *               versionId는 스키마 정의 관심사가 아님. 데이터 적재 시 값과 함께 전달됨.
 */
export type DimKind =
  | { type: "string_enum" }
  | { type: "number_enum" }
  | { type: "index_ref"; indexId: string };

export type EntityId = string | number;

// ── Entry 상태 ───────────────────────────────────────────────────────────────

export type EntryStatus = "active" | "inactive";

export interface EntryFlag {
  status: EntryStatus;
  reason?: string;
  updatedAt: string;
}

// ── Entry-level index_ref ─────────────────────────────────────────────────────

/**
 * 특정 entry 하나가 다른 WeightedIndex의 1D 압축값일 때 붙이는 메타데이터.
 *
 * dim-level index_ref (DimKind.type = "index_ref")와의 차이:
 *   dim-level  → DimKind.indexId로 선언. 모든 entry가 같은 index 계열.
 *                versionId는 수집하지 않음 (호출자가 context로 관리).
 *   entry-level → 특정 셀에만 적용. entry마다 다른 indexId + versionId를 가질 수 있음.
 *                 엔진이 해당 entry를 확장(expand)하려면 prefix + version이 모두 필요.
 */
export interface EntryIndexRef {
  indexId: string;
  versionId: string;
}

// ── 입력 타입 (MetaRegistry 생성자용) ─────────────────────────────────────────

export interface DimSnapshotInput {
  /** 1-based 순번으로 사용될 entity ID 목록. 순서는 불변 (append-only). */
  entries: EntityId[];
  /**
   * 개별 entry 상태 재정의. key = 1-based 인덱스.
   * 명시되지 않은 entry는 active로 간주 (sparse).
   */
  entryFlags?: Record<number, EntryFlag>;
  /**
   * entry-level index_ref 메타데이터. key = 1-based 인덱스.
   * 해당 위치의 entry 값이 다른 WeightedIndex의 1D 압축값임을 선언.
   * 대상 entry는 반드시 number(정수 ≥ 0)여야 함.
   */
  entryRefs?: Record<number, EntryIndexRef>;
  createdAt?: string;
  changelog?: string;
}

// ── DimSnapshot 간 migration ──────────────────────────────────────────────────

/**
 * 두 스냅샷 간 index 위치 변경 동선.
 *
 * 버전이 올라가며 entries 순서/내용이 바뀔 때,
 * "v1의 position 2번이 v2에서는 3번으로 갔다"는 동선을 기록한다.
 * 이를 chain하면 v1 사용자가 v5에서도 동일한 선택을 이어갈 수 있다.
 *
 * indexMap:
 *   - key   = fromSnapshot 기준 1-based index
 *   - value = toSnapshot 기준 1-based index
 *   - 명시 없으면 동일 index 유지 (identity)
 *   - value는 unique (bijection)
 */
export interface DimSnapshotMigration {
  fromSnapshotId: string;
  toSnapshotId: string;
  indexMap: Record<number, number>;
  createdAt?: string;
  changelog?: string;
}

export interface DimInput {
  kind: DimKind;
  description?: string;
  domain?: string;
  /** snapshotId → DimSnapshotInput */
  snapshots: Record<string, DimSnapshotInput>;
  /** 스냅샷 간 index 위치 변경 동선. */
  migrations?: DimSnapshotMigration[];
}

export interface IndexVersionInput {
  /** dimId → snapshotId. IndexDef.dims에 있는 모든 dim을 커버해야 함. */
  snapshots: Record<string, string>;
  createdAt?: string;
  changelog?: string;
}

export interface IndexInput {
  /** 이 인덱스를 구성하는 차원 ID 목록 (순서 고정). */
  dims: string[];
  description?: string;
  domain?: string;
  /** versionId → IndexVersionInput */
  versions: Record<string, IndexVersionInput>;
}

export interface MetaRegistryInput {
  /** dimId → DimInput */
  dims: Record<string, DimInput>;
  /** indexId → IndexInput */
  indices: Record<string, IndexInput>;
}

// ── 저장/조회 타입 ────────────────────────────────────────────────────────────

export interface DimDef {
  id: string;
  /** 이 dim에 들어오는 entry 값의 형태. 불변. */
  kind: DimKind;
  description?: string;
  domain?: string;
}

export interface DimSnapshot {
  dimId: string;
  snapshotId: string;
  /** 불변. entries[i-1] = 1-based index i에 해당하는 entity ID. */
  entries: readonly EntityId[];
  /** sparse: 명시 없으면 active. key = 1-based index. */
  entryFlags: Readonly<Record<number, EntryFlag>>;
  /**
   * entry-level index_ref 메타데이터. key = 1-based index.
   * 해당 entry 값이 다른 WeightedIndex의 1D 압축값임을 나타냄.
   * dim-level index_ref(DimKind)와 독립적으로 적용 가능.
   */
  entryRefs: Readonly<Record<number, EntryIndexRef>>;
  createdAt?: string;
  changelog?: string;
}

export interface IndexDef {
  id: string;
  /** 순서 고정 dim ID 목록. */
  dims: readonly string[];
  description?: string;
  domain?: string;
}

export interface IndexVersion {
  indexId: string;
  versionId: string;
  /** dimId → snapshotId */
  snapshots: Readonly<Record<string, string>>;
  createdAt?: string;
  changelog?: string;
}

// ── 1D 식별자 ─────────────────────────────────────────────────────────────────

/**
 * DB 저장 단위.
 * 직렬화 형식: "{indexId}:{versionId}:{value}"
 */
export interface VersionedValue {
  indexId: string;
  versionId: string;
  value: number;
}

// ── Manifest (프로그래밍 레이어에 제공하는 활성 인덱스 집합) ────────────────────

export interface DimActiveSet {
  dimId: string;
  snapshotId: string;
  /** WeightedIndex shape에 쓰이는 고정값 (= entries.length). inactive가 있어도 불변. */
  total: number;
  /** 현재 active 상태인 1-based 인덱스 목록 (정렬됨). */
  activeIndices: number[];
}

export interface IndexActiveManifest {
  indexId: string;
  versionId: string;
  /** IndexDef.dims 순서 유지. */
  dims: DimActiveSet[];
}
