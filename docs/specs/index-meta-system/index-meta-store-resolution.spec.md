---
def:
  id: index-meta-store-resolution
  address: def_document:v2:343175
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: index-meta
  tags: [runtime, persistence, structural]
  links:
    - target: address-spec
      type: depends_on
    - target: index-meta-store-group
      type: refines
---

# Index Meta Store - 주소 해석과 재사용

## 목적 ^purpose

index-meta 저장소의 인메모리 구현, DB 상태 예시, 주소 해석, 디코딩 없는 주소 재사용 전략을 정리한다.

## 인메모리 구현

테스트 및 개발 목적의 기본 구현체. DB 구현과 동일한 검증 규칙을 적용한다.

```ts
class InMemoryIndexMetaStore implements IndexMetaStore
```

키 전략:
- schema_version: `"${prefix}:${versionId}"`
- entry: `"${prefix}:${versionId}:${position}"`

## VersionLifecycleStore

버전 상태 전이를 관리한다. 생명주기: `draft → released → active → deprecated`.

```ts
interface VersionLifecycleStore {
  createDraft(prefix, versionId, baseVersionId, capacity, deactivationMode?): Promise<VersionRecord>;
  release(prefix, versionId): Promise<void>;     // draft → released
  activate(prefix, versionId): Promise<void>;     // released → active (이전 active → released)
  deprecate(prefix, versionId): Promise<void>;    // active/released → deprecated
  getActive(prefix): Promise<VersionRecord | null>;
  getVersion(prefix, versionId): Promise<VersionRecord | null>;
  getVersions(prefix, status?): Promise<VersionRecord[]>;
}
```

### 비활성화 모드 (DeactivationMode)

prefix 단위 설정. 모든 버전이 동일 모드를 공유한다.

| 모드 | 설명 | 용도 |
|------|------|------|
| `strict` | 비활성화/재활성화는 draft→release 사이클에서만 허용. 변경이 MigrationStore에 불변 이력으로 기록. 캐시 영구 유효. | 권한 스키마, 감사 추적 필수 도메인 |
| `flexible` | 런타임에 EntryFlagStore로 즉시 토글. flag 변경 시 AddressStateStore 재계산 필요. | 피처 플래그, A/B 테스트 |

### 상태 전이 규칙

- `activate()`: 트랜잭션으로 이전 active를 released로 강등 + 대상을 active로 승격.
- `deprecate()`: draft 상태에서는 불가. released 또는 active만 deprecated 가능.
- deactivationMode: 최초 버전에서 지정. 이후 버전은 기반 버전에서 상속.

## MigrationStore

버전 간 EntityId 변경 이력을 추적한다. Position은 불변 — 주소 재매핑 없음.

```ts
interface MigrationStore {
  saveMappings(prefix, mappings: MigrationMapping[]): Promise<void>;
  getHistory(prefix, position): Promise<MigrationMapping[]>;
  getMappings(prefix, fromVersionId, toVersionId): Promise<MigrationMapping[]>;
  resolveToLatest(prefix, fromVersionId, position, latestVersionId): Promise<MigrationResolveResult>;
}
```

### 추적 대상

| changeType | 의미 |
|-----------|------|
| `modified` | EntityId가 변경됨 (oldEntityId → newEntityId) |
| `deactivated` | 해당 position이 비활성화됨 |

금지: position 순서 변경(moved), 완전 삭제(removed).

### resolveToLatest 알고리즘

1. fromVersionId === latestVersionId이면 즉시 반환 (변경 없음).
2. migration_mapping 테이블에서 version 간 엣지를 BFS로 탐색하여 경로 발견.
3. 경로의 각 hop에서 해당 position의 mapping을 조회.
4. `deactivated` 발견 시 즉시 중단 + 결과 반환.
5. 경로가 없으면 빈 chain 반환.

## PrefixRouter

prefix → D1 database 라우팅. PrefixRegistry(capacity 조회)와 별개 관심사.

```ts
interface PrefixRouter {
  getDatabase(prefix: string): Promise<string | null>;
  route(prefix: string, d1DatabaseId: string): Promise<void>;
  listPrefixes(d1DatabaseId: string): Promise<string[]>;
}
```

- composite 테이블은 entry가 없으므로 라우팅 대상이 아님.
- 동일 prefix 재등록 시 덮어쓰기 (라우팅 변경 허용).

## CrossVersionEntrySync — 크로스 버전 동기 전파

`cross-version-entry-sync.ts`의 `CrossVersionEntrySync` 클래스.

prefix의 모든 활성 버전에 entry를 동기 전파한다. Position 불변식을 보장.

### 핵심 원칙

- **Position 불변식**: 모든 버전에서 position N은 항상 position N.
- **active 버전이 SSOT**: active 버전에서 다음 position을 결정하고, 나머지 writable 버전에 전파.
- **MigrationStore와 무관**: 마이그레이션은 release 시 EntityId 수정/비활성화만 추적.

### addEntry 절차

```
1. active 버전 확인 (없으면 ValidationError)
2. active 버전에서 중복 체크 (idempotent — 이미 있으면 기존 position 반환)
3. active 버전에서 다음 position 결정 (maxPos + 1)
4. active 버전 capacity 체크 (초과 시 ValidationError)
5. 모든 writable 버전(draft/released/active) 순회:
   - capacity 부족 → skip (경고)
   - 같은 value 이미 존재 → skip (duplicate)
   - 해당 position에 다른 값 존재 → skip (occupied)
   - 그 외 → insertEntry + cache append
6. 품질 게이트:
   - active 버전은 반드시 삽입되어야 함
   - added + skipped = 모든 writable 버전 (누락 없음)
```

### 결과 타입

```ts
interface CrossVersionAddResult {
  readonly position: number;                // 할당된 position (모든 버전 동일)
  readonly added: readonly string[];        // entry 추가된 버전 목록
  readonly skipped: ReadonlyArray<{ versionId: string; reason: string }>;
}
```

## 주소 해석 (Address Resolution)

PrefixRegistry에 `getShape` + `resolveAddress`를 추가해 주소 문자열에서 모든 정보를 즉시 복원한다.

```ts
getShape(prefix, versionId): Promise<number[]>
// leaf      → [capacity]
// composite → refs.map(r => r.capacity)  ← WeightedIndex 생성에 직접 사용

resolveAddress(serialized: string): Promise<ResolvedAddress | null>
// "perm:v1:1345" → { prefix, versionId, index, capacity, shape, refs, valid }
```

## 디코딩 없는 주소 재사용 (Graph-DB 효율)

leaf 값까지 디코딩하지 않고 1D 정수 주소를 다른 composite의 dim으로 직접 재사용한다.

```
article:v1 = content_type(4) × perm(2048) × lang(2)

"role=editor(position 3)인 article 조회":
  ① perm:v1 shape에서 role dim position=3의 주소 범위 계산 → [from, to]
  ② article:v1 shape에서 perm dim이 [from, to]인 article 주소 범위 계산
  ③ SELECT * FROM article_data WHERE article_index IN (ranges)
```

| 접근 방식 | 비용 |
|----------|------|
| 전체 디코딩 후 필터 | O(n) — 모든 row decode |
| 주소 범위 계산 | O(1) — 산술 연산만, entry 조회 없음 |
