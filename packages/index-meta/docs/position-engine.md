# PositionEngine — Entry Lifecycle 설계

> **EntryLifecycle**: entry가 버전을 거치며 진화하는 데이터 흐름 (draft→released→active→deprecated).
> **PositionEngine**: EntryLifecycle을 지탱하는 구성요소 시스템. Position 안정 축 위의 인프라.
>
> 네이밍 체계: [`naming.md`](naming.md)

---

## 1. 불변식 (Invariants)

### 1.1 Position ↔ EntityId 강결합

```
(prefix, versionId, position) → EntityId   불변. 한번 결정되면 변하지 않음.
(prefix, versionId, EntityId) → position   불변. 동일 보장.
```

- position 1 = "admin"이면 해당 버전에서 영원히 1 = "admin"
- 텍스트(label)가 바뀔 수 있으나, 그것은 표현 변경이지 identity 변경이 아님
- 같은 버전 내에서 두 position이 같은 EntityId를 가질 수 없음

### 1.2 Position은 버전을 초월해 안정적

**Position의 순서는 절대 변경되지 않는다.** 모든 버전에서 position N은 항상 position N이다.

```
v1: pos 1 = "admin", pos 2 = "editor", pos 3 = "viewer"
v2: pos 1 = "admin", pos 2 = "editor", pos 3 = "viewer", pos 4 = "guest"
v3: pos 1 = "admin", pos 2 = "editor", pos 3 = (inactive), pos 4 = "guest"
```

- position 3은 v3에서 비활성화되었지만, 여전히 position 3이다.
- position 3이 position 1로 이동하는 것은 **절대 불가**.
- position 3이 완전히 삭제되는 것도 **절대 불가** (soft delete만 허용).

**이유: 메타데이터 안정성.** Position을 축으로 메타데이터가 관계형으로 연결된다.
순서가 변경되면 메타데이터 소유권을 찾기 위해 모든 마이그레이션 DB를 순회해야 한다.
Position이 안정적이면 메타데이터는 항상 현재 position으로 직접 접근 가능.

### 1.3 마이그레이션 제약

| 허용 | 금지 |
|------|------|
| EntityId 수정 (값 변경) | Position 순서 변경 (재배치) |
| Position 비활성화 (soft delete) | Position 완전 삭제 (hard delete) |
| Capacity 확장 | Position 압축 (번호 재매핑) |

기존 `DimSnapshotMigration.indexMap`의 position 재매핑은 사용하지 않는다.
마이그레이션은 동일 position에서의 EntityId 변경과 비활성화만 추적한다.

### 1.4 비활성화 모드 (DeactivationMode)

prefix 단위로 설정. 모든 버전이 동일한 모드를 공유한다.

| 모드 | 비활성화 경로 | 이력 기록 | 캐시 | 용도 |
|------|-------------|----------|------|------|
| **strict** | draft→release 사이클에서만 허용 | MigrationStore (불변) | 영구 유효 | 권한 스키마, 계약 구조 |
| **flexible** | 런타임 즉시 토글 | EntryFlagStore (가변) | flag 변경 시 재계산 | 피처 플래그, 동적 설정 |

#### strict 모드

```
비활성화 요청
  → 현재 버전 상태 확인
  → draft가 아니면 거부
  → draft에서 비활성화 예약
  → release 시 MigrationStore에 불변 기록
  → MigrationCache 영구 유효
```

- 모든 변경이 감사 추적 가능한 이력으로 남음
- 캐시 불변 보장 → 성능 최적
- 즉시 반영 불가 → 계획적 변경에 적합

#### flexible 모드

```
비활성화/재활성화 요청
  → EntryFlagStore에 즉시 기록 (active ↔ inactive)
  → AddressStateStore 재계산 트리거
  → MigrationStore에는 버전 전이 시 확정 변경만 기록
```

- 런타임 즉시 반영
- EntryFlagStore가 source of truth
- MigrationStore는 버전 전이 시의 스냅샷만 기록 (flexible에서도 버전 생성은 가능)
- flag 변경마다 L3 Range Cache 재계산 필요

#### 모드 상속

```typescript
createDraft(prefix, "v2", "v1", 32)
  → v1의 deactivationMode를 상속
createDraft(prefix, "v1", null, 16, "flexible")
  → 최초 버전: 명시적 모드 지정
```

prefix의 첫 번째 버전 생성 시 모드를 지정하면, 이후 버전은 자동 상속.
기본값은 `"strict"`.

### 1.5 Entry는 Prefix 단위

Entry 추가는 prefix를 기준으로 수행. 버전을 보고 채우지 않음.

```
prefix "role" 에 "guest" 추가
  → 모든 활성 버전에 전파 (headroom 내)
  → 최신 버전 우선: 충돌 시 최신 버전이 거부하면 추가 불가
```

### 1.3 버전 내 불변, 버전 간 변경

| 버전 내 | 버전 변경 시 |
|---------|-------------|
| entry 추가만 가능 (append) | entry 수정, 비활성화, 삭제 가능 |
| 기존 바인딩 불변 | 마이그레이션 테이블로 매핑 추적 |
| capacity 고정 | capacity 변경 = 새 버전 |

---

## 2. 버전 라이프사이클

### 2.1 상태

```
draft → released → active → (deprecated)
```

| 상태 | entry 추가 | entry 수정 | 비활성화 (strict) | 비활성화 (flexible) | encode | decode |
|------|-----------|-----------|-----------------|-------------------|--------|--------|
| draft | O (계획 중) | O (확정 전) | O (예약) | O (즉시) | X | X |
| released | O (headroom 내) | X | X | O (즉시) | O | O |
| active | O (headroom 내) | X | X | O (즉시) | O (권장) | O |
| deprecated | X | X | X | X | X | O (읽기 전용) |

- **draft**: 다음 버전을 계획하는 단계. entry 추가/수정/비활성화 예약 가능.
- **released**: 확정된 버전. entry 추가만 가능 (headroom 내 append). flexible 모드는 flag 토글 가능.
- **active**: 현재 prefix의 권장 버전. 새 encode는 이 버전으로. flexible 모드는 flag 토글 가능.
- **deprecated**: 더 이상 encode 불가. 기존 데이터 decode만 지원. 양쪽 모드 모두 변경 불가.

prefix당 active 버전은 항상 1개. released 버전은 여러 개 공존 가능.

### 2.2 버전 전이

```
v1 (active)
  ↓ v2 draft 생성 (v1 기반)
v1 (active) + v2 (draft)
  ↓ v2에서 변경 계획: pos 15 비활성화, capacity 확장
  ↓ v2 release
v1 (released) + v2 (active)
  ↓ v1 deprecated (선택적)
v1 (deprecated) + v2 (active)
```

### 2.3 Draft에서의 변경

draft 상태에서만 다음이 가능:
- **entry 수정**: EntityId 변경 (position은 유지)
- **entry 비활성화**: 특정 position을 inactive로 마킹 (soft delete)
- **capacity 변경**: shape 확장 (새 headroom 생성)

**금지:**
- position 순서 변경 (재배치)
- position 완전 삭제 (hard delete)

release 시 변경 사항이 확정되고 마이그레이션 테이블에 기록.

---

## 3. 마이그레이션 테이블

### 3.1 역할

버전 간 **변경점만** 추적. Position은 불변이므로 주소 재매핑은 없다.
추적 대상: EntityId 수정, 비활성화.

```
migration_map
  from_version_id  TEXT
  to_version_id    TEXT
  position         INTEGER    -- 변경된 position (불변 축)
  change_type      TEXT       -- 'modified' | 'deactivated'
  old_entity_id    TEXT       -- 변경 전 EntityId (modified인 경우)
  new_entity_id    TEXT       -- 변경 후 EntityId (modified인 경우)
  created_at       TEXT
  PK (from_version_id, to_version_id, position)
```

### 3.2 매핑 유형

```
v1→v2: pos 3 modified  "viewer" → "member"   (EntityId 변경, position 유지)
v1→v2: pos 5 deactivated                      (비활성화, position 유지)
```

변경 없는 position은 저장하지 않음. 매핑이 없으면 = 동일 EntityId + 동일 position.

**금지:** `moved` (position 변경), `removed` (완전 삭제) 유형은 존재하지 않음.

### 3.3 체이닝

Position이 불변이므로 주소 자체는 바뀌지 않는다.
체이닝은 **EntityId 변경 이력** 추적에 사용.

```
pos 3: v1("viewer") → v2("member") → v3(deactivated)
```

유저가 v1:3을 가지고 있으면:
1. v1→v2 migration에서 pos 3 조회 → modified: "viewer"→"member"
2. v2→v3 migration에서 pos 3 조회 → deactivated
3. 결론: v1:3은 현재 active 버전에서 비활성화됨

**주소(position)는 모든 버전에서 동일**하므로 주소 변환은 불필요.
마이그레이션은 "같은 위치의 의미가 어떻게 바뀌었는가"를 추적.

### 3.4 불변성

release 시 마이그레이션 매핑이 생성되면 이후 변경 불가.
→ 캐싱 가능 (영구 유효).

---

## 4. Cross-Version Entry Sync

### 4.1 Position 동일성 불변식

**모든 버전에서 동일한 EntityId는 동일한 position을 갖는다.**

버전마다 다른 position에 entry가 들어가는 경우는 존재하지 않는다.
active 버전이 position을 결정하는 SSOT이며, 나머지 writable 버전에 동일 position으로 전파한다.
따라서 **MigrationStore는 entry 추가에 관여하지 않는다** — 마이그레이션은 오직 release 시 EntityId 수정/비활성화만 추적.

### 4.2 추가 흐름

prefix에 새 entry 추가 시:

```
1. active 버전 조회 (없으면 에러)
2. active 버전에서 중복 체크
   - 이미 존재 → 기존 position 반환 (idempotent)
3. active 버전에서 다음 position 결정 (max position + 1)
   - headroom 있음 → position 확정
   - headroom 없음 → 에러 (capacity 부족)
4. 모든 writable 버전(draft/released/active)에 동일 position으로 전파
   - headroom 있음 → 추가
   - headroom 없음 → skip (경고)
   - 해당 버전에 이미 같은 EntityId 존재 → skip (중복)
   - 해당 position에 다른 값이 점유 → skip (경고)
```

### 4.3 충돌 규칙

| 상황 | 결과 |
|------|------|
| active에 이미 같은 EntityId 존재 | 기존 position 반환 (idempotent) |
| active capacity 부족 | 에러 (전체 실패) |
| 이전 버전에 같은 EntityId 존재 | skip (중복) |
| 이전 버전의 해당 position에 다른 값 | skip (경고) |
| 이전 버전 capacity 부족 | skip (경고) |

### 4.4 에러 처리

- active 버전 insertEntry 실패 → 에러 전파 (전체 실패)
- non-active 버전 insertEntry 실패 → catch하여 skip 처리 (best-effort)
- deprecated 버전에는 전파하지 않음

### 4.5 품질 게이트 (런타임 불변식)

addEntry 완료 직후 다음 사후 조건을 검증한다. 위반 시 `ValidationError`.

| 게이트 | 조건 |
|--------|------|
| active 필수 삽입 | active 버전이 반드시 `added`에 포함 |
| 버전 완전성 | `added.length + skipped.length === writable.length` (누락 없음) |

호출자는 반환된 `CrossVersionAddResult`로 추가 검증 가능:

| 검증 | 방법 |
|------|------|
| 일관성 | 모든 `added` 버전에서 동일 position·value 확인 |
| no phantom | `skipped` 버전에 해당 value가 없음 확인 |
| 단조 증가 | 연속 호출 시 position이 항상 이전보다 큼 |

---

## 5. 캐시 아키텍처

### 5.1 레이어 구조

```
┌─────────────────────────────────────────────────────┐
│  L1: Entry Cache (prefix 단위, 최신 값)               │
│  - position ↔ EntityId 양방향                         │
│  - 중복 체크 O(1)                                     │
│  - CoalescingCache로 miss → fetch → 영구 캐싱         │
├─────────────────────────────────────────────────────┤
│  L2: Migration Cache (버전 쌍 단위, 불변)              │
│  - (fromVersion, address) → (toVersion, address)     │
│  - 한번 캐싱 → 영구 유효                              │
├─────────────────────────────────────────────────────┤
│  L3: Range Cache (버전 단위)                          │
│  - AddressRangeCache: 주소 범위 사전 계산             │
│  - AddressStateStore: 게이트 상태 (active/inactive)   │
│  - 버전 release 시 계산, 이후 불변                    │
├─────────────────────────────────────────────────────┤
│  L4: Backing Store (DB)                              │
│  - IndexMetaStore: entry 원본                         │
│  - MigrationStore: 마이그레이션 매핑 원본             │
│  - SqlDriver 기반                                     │
└─────────────────────────────────────────────────────┘
```

### 5.2 L1: Entry Cache

```typescript
interface EntryCache {
  /** position → EntityId. miss 시 DB fetch. */
  getByPosition(prefix: string, versionId: string, position: number): Promise<EntityId | null>;

  /** EntityId → position. miss 시 DB fetch. */
  getByValue(prefix: string, versionId: string, value: EntityId): Promise<number | null>;

  /** prefix의 전체 entry 목록 (캐시 우선). */
  getAll(prefix: string, versionId: string): Promise<EntryRecord[]>;

  /** 중복 체크. 캐시에서 O(1). */
  exists(prefix: string, versionId: string, value: EntityId): boolean;

  /** 캐시된 entry 수. */
  size(prefix: string, versionId: string): number;
}
```

**캐시 키**: `${prefix}\0${versionId}` → 양방향 Map (position↔EntityId)

**갱신 정책**: miss → single-flight fetch → 영구 캐싱. TTL/invalidation 없음.

**초기화**: 최초 접근 시 해당 (prefix, versionId)의 전체 entry를 bulk load.
이후 개별 miss는 새 append된 entry에 대한 것.

### 5.3 L2: Migration Cache

```typescript
interface MigrationCache {
  /** position의 변경 이력 조회 (캐시 우선). */
  getHistory(prefix: string, position: number): Promise<MigrationMapping[]>;

  /** position의 현재 상태 resolve (캐시 우선). */
  resolveToLatest(prefix: string, fromVersionId: string, position: number): Promise<{
    currentVersionId: string;
    currentEntityId: EntityId | null;
    chain: MigrationMapping[];
  }>;
}
```

**캐시 키**: `${prefix}\0${fromVersionId}\0${toVersionId}` → MigrationMapping[]

**갱신 정책**: 불변 (release 시 생성, 이후 변경 없음). TTL 없음.

Position이 불변이므로 주소 변환 자체가 불필요. 캐시는 EntityId 변경 이력만 추적.

### 5.4 L3: Range Cache (기존)

- `AddressRangeCache`: 주소 범위 사전 계산 결과 (calcAddressRanges)
- `AddressStateStore`: 게이트 상태 (reserved/inactive/open 범위)

버전 release 시 한번 계산, 이후 불변.
entry 추가로 인한 open → active 전환 시 재계산 필요.

### 5.5 캐시 갱신 트리거

| 이벤트 | 모드 | L1 Entry | L2 Migration | L3 Range |
|--------|------|----------|-------------|----------|
| entry 추가 (headroom 내) | 공통 | miss → fetch | 변경 없음 | open 범위 축소 |
| 버전 release | 공통 | 새 파티션 생성 | 매핑 생성 | 범위 계산 |
| entry 비활성화 (draft→release) | strict | 변경 없음 | 매핑 생성 | inactive 범위 추가 |
| entry 비활성화 (런타임 토글) | flexible | 변경 없음 | 변경 없음 | **즉시 재계산** |
| entry 재활성화 (런타임 토글) | flexible | 변경 없음 | 변경 없음 | **즉시 재계산** |

---

## 6. 인터페이스 정의

### 6.1 VersionLifecycle

```typescript
type VersionStatus = 'draft' | 'released' | 'active' | 'deprecated';
type DeactivationMode = 'strict' | 'flexible';

interface VersionRecord {
  prefix: string;
  versionId: string;
  status: VersionStatus;
  baseVersionId: string | null;  // draft의 기반 버전
  capacity: number;
  deactivationMode: DeactivationMode;  // prefix 단위, 버전 간 상속
  createdAt: string;
  releasedAt: string | null;
}

interface VersionLifecycleStore {
  /** draft 생성. deactivationMode: 최초 버전 시 지정, 이후 상속. */
  createDraft(prefix: string, versionId: string, baseVersionId: string | null, capacity: number, deactivationMode?: DeactivationMode): Promise<VersionRecord>;

  /** draft를 release. 마이그레이션 매핑 확정. */
  release(prefix: string, versionId: string): Promise<void>;

  /** active 버전 교체. 이전 active → released. */
  activate(prefix: string, versionId: string): Promise<void>;

  /** deprecated 처리. encode 차단. */
  deprecate(prefix: string, versionId: string): Promise<void>;

  /** prefix의 현재 active 버전. */
  getActive(prefix: string): Promise<VersionRecord | null>;

  /** prefix의 모든 버전 (상태별 필터). */
  getVersions(prefix: string, status?: VersionStatus): Promise<VersionRecord[]>;
}
```

### 6.2 MigrationStore

```typescript
interface MigrationMapping {
  fromVersionId: string;
  toVersionId: string;
  position: number;           // 불변 축
  changeType: 'modified' | 'deactivated';
  oldEntityId: EntityId | null;  // modified인 경우
  newEntityId: EntityId | null;  // modified인 경우
  createdAt: string;
}

interface MigrationStore {
  /** 매핑 일괄 저장 (release 시). */
  saveMappings(prefix: string, mappings: MigrationMapping[]): Promise<void>;

  /** 특정 position의 변경 이력 조회. */
  getHistory(prefix: string, position: number): Promise<MigrationMapping[]>;

  /** 버전 간 전체 변경 조회. */
  getMappings(prefix: string, fromVersionId: string, toVersionId: string): Promise<MigrationMapping[]>;

  /** position의 현재 상태까지 체이닝. */
  resolveToLatest(prefix: string, fromVersionId: string, position: number): Promise<{
    currentVersionId: string;
    currentEntityId: EntityId | null;  // null = deactivated
    chain: MigrationMapping[];
  }>;
}
```

### 6.3 CrossVersionEntrySync

```typescript
interface CrossVersionAddResult {
  /** 할당된 position (모든 버전 동일) */
  readonly position: number;
  /** entry가 추가된 버전 목록 */
  readonly added: readonly string[];
  /** 건너뛴 버전 */
  readonly skipped: ReadonlyArray<{ versionId: string; reason: string }>;
}

class CrossVersionEntrySync {
  constructor(
    versions: VersionLifecycleStore,
    store: IndexMetaStore,
    cache: EntryCache,
  );

  /**
   * prefix의 모든 writable 버전에 entry 추가.
   * active 버전이 position SSOT. MigrationStore 무관.
   *
   * 에러 처리:
   * - active insertEntry 실패 → 에러 전파 (전체 실패)
   * - non-active insertEntry 실패 → catch, skipped에 "store error: ..." 기록
   *
   * 사후 불변식 (위반 시 ValidationError):
   * - active 버전이 반드시 added에 포함
   * - added.length + skipped.length === writable 버전 수
   */
  addEntry(prefix: string, value: EntityId): Promise<CrossVersionAddResult>;
}
```

---

## 7. Metadata (인덱스 키 기반 관계형 데이터)

### 7.1 핵심 개념

Position을 축(key)으로 하는 관계형 메타데이터. Position이 버전을 초월해 안정적이므로,
메타데이터는 **버전에 종속되지 않고 position에 직접 연결**된다.

```
index "role" position 1 ("admin")
  ├─ metadata: { display_name: "관리자", icon: "shield", color: "#ff0000" }
  ├─ metadata: { permissions: ["read", "write", "delete", "admin"] }
  └─ metadata: { created_by: "system", created_at: "2026-01-01" }
```

### 7.2 D1 (순수 1차원) prefix도 메타데이터 지원

n차원 index뿐 아니라 1차원 prefix도 동일한 메타데이터 구조를 가진다.

```
prefix "config" (1D, capacity 16)
  pos 1 = "theme"      → metadata: { value: "dark", updated_at: "..." }
  pos 2 = "locale"     → metadata: { value: "ko-KR", updated_at: "..." }
  pos 3 = "timezone"   → metadata: { value: "Asia/Seoul" }
```

### 7.3 Active 수렴

메타데이터 조회는 **항상 active 버전의 인덱스로 수렴**한다.

```
유저가 v1:3 ("viewer") 의 메타데이터를 조회
  → active 버전 = v3
  → v3에서 pos 3 = deactivated
  → 메타데이터: 비활성 상태임을 반환 (또는 마지막 활성 시점의 메타데이터)

유저가 v1:1 ("admin") 의 메타데이터를 조회
  → active 버전 = v3
  → v3에서 pos 1 = "admin" (불변)
  → 메타데이터: active 버전의 pos 1 메타데이터 반환
```

Position이 안정적이므로 **마이그레이션 테이블을 순회할 필요 없이** 바로 active 버전의
position으로 메타데이터에 접근한다.

### 7.4 스키마

```
entry_metadata
  prefix       TEXT
  position     INTEGER      -- 안정적인 축 (버전 무관)
  key          TEXT          -- 메타데이터 키
  value        TEXT          -- JSON 값
  updated_at   TEXT
  PK (prefix, position, key)
```

- 버전 컬럼 없음: position이 버전을 초월해 안정적이므로 불필요
- 복합 인덱스(n차원)의 경우: 1D 주소(composite address)가 position 역할
- 1D prefix의 경우: position이 그대로 키

### 7.5 인터페이스

```typescript
interface EntryMetadataStore {
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
```

### 7.6 캐시

메타데이터는 가변(mutable)이므로 L1 Entry Cache와 다른 정책:

| 속성 | L1 Entry Cache | Metadata Cache |
|------|---------------|----------------|
| 불변성 | 불변 (영구 유효) | 가변 (upsert 가능) |
| TTL | 없음 | 선택적 (CoalescingCache.isStale) |
| invalidation | 없음 | set/delete 시 invalidate |

---

## 8. 기존 구현과의 관계

### 변경 없이 유지

| 모듈 | 역할 |
|------|------|
| `MetaRegistry` / `MetaCodec` | 스키마 정의 + encode/decode (불변 로직) |
| `WeightedIndex` | mixed-radix 수학 (변경 없음) |
| `IndexClient` / `createIndexSDK` | 경량 소비 레이어 |
| `matchRules` / `resolvePolicy` | 규칙 매칭 (불변 로직) |
| `CoalescingCache` | 범용 캐시 프리미티브 |

### 확장/래핑

| 모듈 | 변경 |
|------|------|
| `IndexMetaStore` | MigrationStore 인터페이스 추가 |
| `EntryFlagStore` | VersionLifecycleStore와 연동 (비활성화 시점 = release) |
| `AddressStateStore` | release 시 자동 재계산 트리거 |
| `AddressRangeCache` | release 시 자동 재계산 트리거 |
| `applyEntryBatch` | CrossVersionEntrySync 기반으로 재구현 |
| `DimSnapshotMigration` | indexMap(position 재매핑) 사용 금지. EntityId 변경 + 비활성화만 추적 |

### 신규 구현 (PositionEngine)

| 모듈 | 역할 |
|------|------|
| `VersionLifecycleStore` | 버전 상태 관리 (draft/released/active/deprecated) |
| `MigrationStore` | 버전 간 변경 이력 (EntityId 수정, 비활성화) |
| `EntryCache` | L1 prefix 단위 양방향 entry 캐시 |
| `MigrationCache` | L2 불변 마이그레이션 이력 캐시 |
| `CrossVersionEntrySync` | 멀티 버전 entry 동기화 |
| `EntryMetadataStore` | position 기반 관계형 메타데이터 |

---

## 8. 구현 순서

### Phase 1: 인터페이스 + InMemory ✅
1. `VersionLifecycleStore` 인터페이스 + InMemory 구현
2. `MigrationStore` 인터페이스 + InMemory 구현
3. `EntryCache` (CoalescingCache 기반)
4. `MigrationCache` (CoalescingCache 기반)
5. 테스트: 버전 라이프사이클 + 마이그레이션 체이닝

### Phase 2: Cross-Version Sync ✅
6. `CrossVersionEntrySync` 구현 — active 버전이 position SSOT, 동일 position 전파, MigrationStore 무관
7. 테스트: 멀티 버전 entry 추가 + capacity 제약 + idempotent + prefix 격리

### Phase 3: Range 재계산 연동
9. release 시 AddressStateStore 자동 재계산
10. release 시 AddressRangeCache 자동 재계산
11. 테스트: 비활성화 → range 반영 E2E

### Phase 4: Metadata ✅
12. `EntryMetadataStore` 인터페이스 + InMemory 구현
13. 테스트: 메타데이터 CRUD + prefix 격리 + JSON 값

### Phase 5: SQL 어댑터
15. SqlVersionLifecycleStore
16. SqlMigrationStore
17. SqlEntryMetadataStore
18. 스키마 DDL 추가
