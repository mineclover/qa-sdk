---
def:
  tier: component
  id: cq-version-query
  address: def_document:v2:68754
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: query-service
  tags: [query, versioning, runtime]
  links:
    - target: wi-api
      type: depends_on
    - target: registry-version-lifecycle
      type: depends_on
sources:
  - packages/index-meta/src/version-query.ts
  - packages/index-meta/src/version-query.test.ts
  - packages/index-meta/src/meta-registry.ts
  - packages/query-service/src/lib/query-service.ts
  - packages/query-service/src/routes/query.ts
  - packages/query-service/src/app.test.ts
---
# Version Query

## 목적 ^purpose

동일 index의 여러 version을 횡단하여 entity 기준 범위 조회, entity 존재 version 조회, position constraint 변환을 수행하는 함수.

소스: `packages/index-meta/src/version-query.ts`, `packages/index-meta/src/version-query.test.ts`, `packages/query-service/src/lib/query-service.ts`

## 구성 ^overview

Version Query는 세 가지 함수로 구성된다.

1. **queryAcrossVersions** — 동일 제약 조건으로 여러 버전의 주소 범위를 한 번에 계산
2. **entityVersionSpan** — 특정 entity가 존재하는 index version 목록을 반환
3. **translateConstraint** — fromVersion position constraint를 toVersion position constraint로 변환

소스:
- `packages/query-service/src/lib/query-service.ts` — queryAcrossVersions
- `packages/index-meta/src/version-query.ts` — queryAcrossVersions/entityVersionSpan/translateConstraint
- `packages/index-meta/src/meta-registry.ts` — index version, dim snapshot, migration edge 조회

## queryAcrossVersions

### 시그니처

```typescript
queryAcrossVersions(
  indexId: string,
  versionIds: readonly string[],
  constraint: Record<string, EntityId | null>,
): Map<string, [number, number][]>
```

### 동작

동일 index의 여러 version에 대해 같은 제약 조건을 적용하고, 버전별 주소 범위를 반환한다.

```typescript
const result = service.queryAcrossVersions(
  "api_perm",
  ["pv1", "pv2", "pv3"],
  { role: "editor", action: null },
);
// Map {
//   "pv1" => [[64, 127]],     // v1에서 editor의 주소 범위
//   "pv2" => [[128, 255]],    // v2에서 editor의 주소 범위 (shape 변경)
//   "pv3" => [[128, 255]],    // v3에서 동일
// }
```

### 용도

- 구버전 데이터와 신버전 데이터의 주소 범위를 동시에 파악
- 마이그레이션 전후 영향 범위 분석
- 히스토리 쿼리 (특정 entity의 모든 버전에 걸친 데이터 조회)

## entityVersionSpan

### 시그니처

```typescript
entityVersionSpan(
  indexId: string,
  dimId: string,
  entityId: EntityId,
  registry: MetaRegistry,
  options?: { activeOnly?: boolean },
): string[]
```

### 동작

- index에 `dimId`가 포함되어 있는지 검증한다.
- 모든 version의 해당 dim snapshot에서 `entityId`가 존재하는지 확인한다.
- `activeOnly: true`이면 inactive entry가 있는 version을 제외한다.

### 에러 처리

| 상황 | 에러 타입 |
|------|----------|
| index에 없는 dim | `ValidationError` |
| entity가 없는 version | 결과에서 제외 |

## translateConstraint

### 시그니처

```typescript
translateConstraint(
  indexId: string,
  fromVersion: string,
  toVersion: string,
  constraint: Record<string, CoordConstraint>,
  registry: MetaRegistry,
): Record<string, CoordConstraint> | null
```

### 변환 흐름

```
1. fromVersion === toVersion이면 constraint 복사본 반환
2. index dim 순서대로 from/to snapshot 비교
3. 동일 snapshot이면 constraint 그대로 유지
4. snapshot이 다르면 position constraint를 개별 position으로 파싱
5. migration edge가 있으면 `traceMigration()`으로 position 변환
6. edge가 없으면 from entityId를 to snapshot에서 찾아 암묵 이동
7. target version에 entity가 없으면 null 반환
```

### 용도

- rule migration에서 StoredPolicyRule pattern을 새 version 기준으로 변환
- append-only version에서 기존 position 보존
- migration edge가 있는 version에서 명시적 position mapping 적용

## MetaRegistry version/snapshot 관리

소스: `packages/index-meta/src/meta-registry.ts`

각 dim snapshot은 entity 배열과 entry lifecycle flag를 보유하고, index version은 dimId → snapshotId 매핑으로 구성된다.

### 설계 원칙

- entity ID 순서 = 1-based position: `entries[0] → 1`, `entries[1] → 2`
- append-only snapshot이면 기존 position이 보존된다.
- shrink/reorder는 migration edge 또는 entity 기반 변환 결과에 따라 처리된다.
- inactive entry는 `entityVersionSpan(..., { activeOnly: true })`에서 제외된다.

### 버전 조회 API

| 메서드 | 설명 |
|--------|------|
| `getVersionIds(indexId)` | index version ID 목록 |
| `getIndexVersion(indexId, versionId)` | index version snapshot 매핑 조회 |
| `getDimSnapshot(dimId, snapshotId)` | dim snapshot entries/flags 조회 |
| `isEntryActive(dimId, snapshotId, position)` | entry active 여부 |
| `traceMigration(dimId, fromSnapshotId, toSnapshotId, position)` | migration edge 기반 position 변환 |

### PrefixVersionEntry

```typescript
interface IndexVersionInput {
  snapshots: Record<string, string>; // dimId → snapshotId
}
```

index version은 각 dim에서 어떤 snapshot을 사용할지의 스냅샷이다. shape은 각 snapshot의 entries 길이로 도출된다.

## HTTP 엔드포인트

```
POST /query-across-versions
  Body: { indexId, versionIds, constraint }
  Response: { "pv1": [[0, 63]], "pv2": [[0, 127]] }
```

`entityVersionSpan()`과 `translateConstraint()`는 HTTP 라우트가 아니라 라이브러리/마이그레이션용 함수다. query-service의 REST 표면에는 현재 `POST /query-across-versions`가 노출된다.
