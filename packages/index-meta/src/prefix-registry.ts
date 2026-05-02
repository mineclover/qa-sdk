// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * PrefixRegistry — 주소 공간 DAG의 중앙 관리자
 *
 * SemanticAddress { schema, version, index } 에서
 *   - schema  = prefix
 *   - version = versionId
 *   - index   = 1D 인코딩 결과
 *
 * "perm:v1:1345" 같은 주소를 디코딩하려면
 * perm v1이 어떤 prefix들을 어느 버전으로 조합했는지 알아야 한다.
 * 이 관계(DAG)를 영속화하는 것이 PrefixRegistry의 핵심 역할이다.
 */

// ── DimRef — 단일 차원 참조 ───────────────────────────────

/**
 * composite prefix의 한 dim이 참조하는 1D 주소 공간.
 *
 * SemanticAddress에서 index가 빠진 형태:
 *   { prefix: "role", versionId: "v1", capacity: 8 }
 *   = "role:v1" 주소 공간에서 0~7 범위의 값을 이 dim으로 사용
 */
export interface DimRef {
  readonly prefix: string;
  readonly versionId: string;
  readonly capacity: number;
}

// ── PrefixRegistryRecord ──────────────────────────────────

/**
 * 중앙 prefix 레지스트리의 단일 레코드.
 *
 * leaf:      refs 없음. capacity = 직접 선언된 주소 공간 크기.
 * composite: refs = 참조하는 dim들의 DimRef 목록.
 *            capacity = refs[i].capacity의 곱 (자동 계산).
 *
 * refs가 있으면 "perm:v1:1345" 같은 주소를 DB만으로 완전 복원 가능:
 *   1. refs → shape 복원
 *   2. WeightedIndex(shape).decode(1345) → 각 dim 좌표
 *   3. 각 좌표 → DimRef의 prefix:versionId 주소 공간에서 entry 조회
 *   4. (재귀) DimRef가 다시 composite이면 동일 과정 반복
 */
export interface PrefixRegistryRecord {
  readonly prefix: string;
  readonly versionId: string;
  readonly capacity: number;
  /** composite만 존재. IndexDef.dims 순서와 동일. */
  readonly refs?: readonly DimRef[];
}

// ── PrefixRegistry 인터페이스 ─────────────────────────────

export interface PrefixRegistry {
  /** (prefix, versionId) 등록. 중복은 에러. */
  register(record: PrefixRegistryRecord): Promise<void>;

  /**
   * 기존 (prefix, versionId)의 capacity를 갱신한다.
   * capacity headroom 확장 시 사용. 미등록이면 에러.
   *
   * composite의 경우 refs의 capacity도 함께 갱신한다.
   */
  updateCapacity(
    prefix: string,
    versionId: string,
    capacity: number,
    refs?: readonly DimRef[],
  ): Promise<void>;

  /** capacity fast-path 조회. WeightedIndex shape 계산의 핵심 경로. 없으면 null. */
  getCapacity(prefix: string, versionId: string): Promise<number | null>;

  /** 레코드 전체 조회. refs 포함. 없으면 null. */
  getRecord(prefix: string, versionId: string): Promise<PrefixRegistryRecord | null>;

  /** prefix의 모든 버전 목록. */
  listVersions(prefix: string): Promise<PrefixRegistryRecord[]>;

  /** 전체 레지스트리 내보내기. 백업·복원에 사용. */
  listAll(): Promise<PrefixRegistryRecord[]>;

  /**
   * composite prefix의 직접 참조 dim 목록.
   * leaf이거나 미등록이면 빈 배열.
   *
   * "perm:v1"의 refs → [role:v1, action:v1, resource:v1, env:v1]
   */
  getDeps(prefix: string, versionId: string): Promise<readonly DimRef[]>;

  /**
   * 전이적 의존 관계 조회 (DFS).
   * "perm:v1"의 transitive deps → role:v1, action:v1, resource:v1, env:v1
   *   + 각 ref가 composite이면 그 ref들의 deps도 포함.
   *
   * composite를 포함한 중첩 구조에서 전체 의존 그래프를 평탄화한다.
   */
  getTransitiveDeps(prefix: string, versionId: string): Promise<readonly DimRef[]>;

  /**
   * 역방향 조회: 이 prefix:versionId를 dim으로 참조하는 composite 목록.
   * 새 버전 필요 여부 cascade 감지에 사용.
   *
   * role:v1이 변경될 때 → perm:v1이 영향을 받는다.
   */
  getReverseRefs(prefix: string, versionId: string): Promise<readonly PrefixRegistryRecord[]>;

  /**
   * WeightedIndex 생성에 직접 사용할 shape 배열 반환.
   *
   * leaf      → [capacity]
   * composite → refs.map(r => r.capacity)
   * 미등록    → null
   */
  getShape(prefix: string, versionId: string): Promise<number[] | null>;

  /**
   * 주소 문자열 파싱 + 전체 정보 복원.
   *
   * "perm:v1:1345" → {
   *   prefix, versionId, index,
   *   capacity, shape, refs,
   *   valid: index < capacity
   * }
   *
   * 미등록 prefix → null.
   */
  resolveAddress(serialized: string): Promise<ResolvedAddress | null>;
}

// ── ResolvedAddress ───────────────────────────────────────

/**
 * 주소 문자열 해석 결과.
 *
 * shape만 있으면 WeightedIndex 없이도 decode 가능:
 *   WeightedIndex(shape).decode(index) → coords
 *
 * refs가 있으면 graph 탐색 가능:
 *   각 coord → 해당 DimRef의 prefix:versionId 주소 공간에서 entry 조회
 *   (재귀) DimRef가 composite이면 동일 과정 반복
 */
export interface ResolvedAddress {
  readonly prefix: string;
  readonly versionId: string;
  readonly index: number;
  readonly capacity: number;
  /** WeightedIndex(shape).decode(index)로 coords 복원 가능. */
  readonly shape: number[];
  /** composite면 dim 참조 목록. leaf면 []. graph 탐색에 사용. */
  readonly refs: readonly DimRef[];
  /** index가 [0, capacity-1] 범위 내인지 */
  readonly valid: boolean;
}
