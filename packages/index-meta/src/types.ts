import type { PackFormat, ShardingStrategy, EntityId, VersionedValue } from "weighted-index";

/**
 * index-meta — 닫힌 패턴의 1차원 주소를 위한 DB 라이브러리 타입 정의
 *
 * ── 목적 ───────────────────────────────────────────────────────────────────
 *
 * 닫힌 패턴(closed pattern)이란 각 차원의 가능한 값이 미리 열거된 유한 상태 공간이다.
 * index-meta는 그 패턴의 스키마를 정의하고 버전으로 관리하며,
 * 임의의 좌표를 "1차원 주소"(단일 정수)로 압축·복원하는 DB 레이어를 제공한다.
 *
 * VersionedValue { indexId, versionId, value } 가 곧 1차원 주소다.
 * value는 WeightedIndex가 계산한 압축 정수이며, indexId + versionId가 있어야
 * 어떤 패턴 스키마로 압축된 값인지 알 수 있어 완전한 복원이 가능하다.
 *
 * ── 엔티티 계층 ─────────────────────────────────────────────────────────────
 *
 *  DimDef      : 차원 슬롯 정의 — 이 차원에 들어오는 값의 형태(kind)를 선언
 *  DimSnapshot : 해당 차원의 특정 시점 값 목록 (닫힌 집합의 스냅샷)
 *  IndexDef    : 차원들의 순서 있는 조합 — 하나의 닫힌 패턴 스키마
 *  IndexVersion: IndexDef의 한 버전 — 각 차원이 어느 DimSnapshot을 사용하는지
 *
 * ── DimKind ─────────────────────────────────────────────────────────────────
 *
 *  string_enum : entries가 string[]. 값 자체가 identity.
 *                예) ["admin", "editor", "viewer"]
 *
 *  number_enum : entries가 number[]. 숫자 자체가 identity. 외부 참조 없음.
 *
 *  index_ref   : entries가 number[]. 각 값은 다른 닫힌 패턴의 1차원 주소.
 *                indexId로 어느 패턴의 주소인지 선언한다.
 *                예) [0, 4, 8] ← doc_meta 패턴의 압축 주소들
 *
 * ── 1차원 주소 복원 경로 ─────────────────────────────────────────────────────
 *
 *  VersionedValue { indexId, versionId, value }   ← 1차원 주소
 *    → IndexDef[indexId].dims          → [dim_0, ..., dim_n]
 *    → IndexVersion[indexId,versionId] → { dim_i: snapshotId_i }
 *    → DimSnapshot[dim_i, snapshotId_i].entries.length → N_i  (shape)
 *    → WeightedIndex(shape).decode(value) → coords
 *    → DimSnapshot[dim_i, snapshotId_i].entries[coord_i - 1] → entry value
 *       ↳ string_enum / number_enum → 그대로 반환
 *       ↳ index_ref   → 반환값이 또 다른 닫힌 패턴의 1차원 주소 (재귀 확장 가능)
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

export type { EntityId };

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

// ── Address 프로토콜 바인딩 ──────────────────────────────────────────────────

/**
 * MetaRegistry의 VersionedValue를 hex 컨테이너(UUID, int64 등)로 직렬화하기 위한 설정.
 *
 * layout protocol을 구성해 SemanticAddress ↔ 포맷 문자열 변환을 가능하게 한다.
 * 이를 통해 VersionedValue를 RDB PK 등 외부 시스템의 식별자로 직접 사용할 수 있다.
 *
 * @example
 * ```ts
 * address: {
 *   format: PACK_FORMATS.uuid,
 *   schemaChars: 4,
 *   versionChars: 2,
 *   schemas:  { perm: 1, content: 2 },
 *   versions: { v1: 1, v2: 2, iv1: 1, iv2: 2 },
 * }
 * ```
 *
 * Layout: [schema(4hex) | version(2hex) | ...gap... | index]
 * 예) perm:v1:42 → "00010001-0000-0000-0000-00000000002a" (UUID)
 */
export interface AddressConfig {
  /** 컨테이너 포맷 (PACK_FORMATS.uuid, PACK_FORMATS.int64 등) */
  format: PackFormat;
  /** schema(indexId) 필드에 할당할 hex 자릿수 */
  schemaChars: number;
  /** version(versionId) 필드에 할당할 hex 자릿수 */
  versionChars: number;
  /**
   * 샤딩 전략. 설정 시 layout이 [schema | version | shard | gap | index]로 확장된다.
   * shard = VersionedValue.value % numShards 로 자동 계산된다 (호출자 개입 불필요).
   *
   * @example
   * sharding: { type: "modulo", chars: 1, numShards: 4 }
   * // value=42 → shard = 42 % 4 = 2 → UUID 7번째 hex 자리에 삽입
   */
  sharding?: ShardingStrategy;
  /**
   * indexId → 숫자 매핑. layout protocol에서 schema 필드 값으로 사용.
   * registry에 등록된 모든 indexId를 포함해야 한다.
   */
  schemas: Record<string, number>;
  /**
   * versionId → 숫자 매핑. layout protocol에서 version 필드 값으로 사용.
   * registry에 등록된 모든 인덱스의 모든 versionId를 포함해야 한다.
   */
  versions: Record<string, number>;
}

export interface MetaRegistryInput {
  /** dimId → DimInput */
  dims: Record<string, DimInput>;
  /** indexId → IndexInput */
  indices: Record<string, IndexInput>;
  /**
   * 선택적 주소 프로토콜 바인딩.
   * 설정하면 layout protocol 기반 직렬화(toPK/fromPK)를 사용할 수 있다.
   * 미설정 시에도 colon/uri/compact 텍스트 프로토콜은 사용 가능.
   */
  address?: AddressConfig;
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

export type { VersionedValue };

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

// ── Resolver 출력 타입 ───────────────────────────────────────────────────────

/**
 * 특정 index version의 디코딩에 필요한 최소 데이터 번들.
 *
 * 외부 시스템(DB, 프론트엔드, 마이크로서비스 등)에 이 번들을 전달하면
 * MetaRegistry 없이도 value → entity ID 복원이 가능하다.
 *
 * 디코딩 절차:
 *   1. weights 계산: weights[i] = product(shape[i+1:])
 *   2. 좌표 복원: coord[i] = floor(remaining / weights[i]) + 1, remaining %= weights[i]
 *   3. entity 매핑: dims[i].entries[coord[i] - 1]
 */
export interface DecodeMap {
  indexId: string;
  versionId: string;
  /** 각 dim의 entries.length 배열. WeightedIndex 생성에 사용. */
  shape: number[];
  /** shape의 곱 = 가능한 value 범위 [0, size-1]. */
  size: number;
  /** IndexDef.dims 순서 유지. */
  dims: {
    dimId: string;
    snapshotId: string;
    kind: DimKind;
    /** entries[i-1] = 1-based coord i의 entity ID. */
    entries: EntityId[];
  }[];
  /** address 설정이 있으면 PK 파싱에 필요한 정보도 포함. */
  address?: AddressConfig;
}

/**
 * 하나의 dim의 모든 snapshot 데이터.
 * 버전 range(v1~v5 등)를 한 번에 조회할 때 사용한다.
 */
export interface DimRange {
  dimId: string;
  kind: DimKind;
  description?: string;
  snapshots: {
    snapshotId: string;
    entries: EntityId[];
    /** active 상태인 1-based 인덱스 목록. */
    activeIndices: number[];
    /** entries.length. shape 계산에 사용. */
    total: number;
  }[];
}

/**
 * 하나의 index의 모든 version 데이터.
 * 인덱스별로 version range를 조회할 때 사용한다.
 */
export interface IndexRange {
  indexId: string;
  description?: string;
  dimIds: string[];
  versions: {
    versionId: string;
    shape: number[];
    size: number;
    dims: {
      dimId: string;
      snapshotId: string;
      kind: DimKind;
      entries: EntityId[];
      activeIndices: number[];
    }[];
  }[];
}

/**
 * 전체 레지스트리의 구조화된 데이터셋.
 * index별로 그룹핑된 version range + dim별 snapshot range.
 */
export interface MetaDataset {
  indices: IndexRange[];
  dims: DimRange[];
}
