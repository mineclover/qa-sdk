---
def:
  id: cq-version-query
  address: def_document:v2:68754
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: query-service
  tags: [tier-infra]
  links:
    - target: wi-api
      type: depends_on
    - target: registry-version-lifecycle
      type: depends_on
---
# Version Query

## 목적 ^purpose

동일 prefix의 여러 버전을 횡단하여 주소 변환, 히스토리 조회, 마이그레이션 경로 탐색을 수행하는 함수.

## 구성 ^overview

Version Query는 세 가지 기능으로 구성된다.

1. **queryAcrossVersions** — 동일 제약 조건으로 여러 버전의 주소 범위를 한 번에 계산
2. **PrefixCodec.migrate** — 구버전 주소를 신버전으로 좌표 변환
3. **PrefixCodec.diff** — 두 버전 사이의 변경 내역 (레이블별 max 변화)

소스:
- `packages/query-service/src/lib/query-service.ts` — queryAcrossVersions
- `packages/weighted-index/src/vocab/prefix-registry.ts` — PrefixCodec (migrate, diff)
- `packages/weighted-index/src/vocab/label-registry.ts` — LabelRegistry (버전별 entity 매핑)

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

동일 prefix의 여러 버전에 대해 같은 제약 조건을 적용하고, 버전별 주소 범위를 반환한다.

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

## PrefixCodec.migrate

### 시그니처

```typescript
migrate(
  vi: VersionedIndex,
  toVersion: string,
  migrator: CoordMigrator,
): VersionedIndex
```

### CoordMigrator 인터페이스

```typescript
type CoordMigrator = (
  oldCoords: number[],
  oldLabels: readonly string[],
  newLabels: readonly string[],
) => number[];
```

호출자가 직접 변환 로직을 제공한다. 라이브러리는 좌표 범위 검증만 수행.

### 변환 흐름

```
1. fromWi.decode(vi.id) → oldCoords (구버전 좌표 복원)
2. migrator(oldCoords, oldLabels, newLabels) → newCoords (사용자 변환)
3. 검증: newCoords.length === toWi.shape.length
4. 각 좌표: 1 <= newCoords[i] <= toWi.shape[i]
5. toWi.encodeUnsafe(newCoords) → 신버전 주소
```

### 에러 처리

| 상황 | 에러 타입 |
|------|----------|
| 좌표 개수 불일치 | `MigrateError` |
| 좌표 범위 초과 | `MigrateError` (dim index + label 정보 포함) |
| 미등록 버전 | `VersionNotFoundError` |

## PrefixCodec.diff

### 시그니처

```typescript
diff(
  prefix: string,
  fromVersion: string,
  toVersion: string,
): PrefixVersionDiff
```

### 출력 구조

```typescript
interface PrefixVersionDiff {
  prefix: string;
  from: string;               // 구버전 ID
  to: string;                 // 신버전 ID
  changedLabels: Array<{
    label: string;            // 변경된 레이블 이름
    fromLabelVersion: string; // 구버전의 label version
    fromMax: number;          // 구버전의 entity 수
    toLabelVersion: string;   // 신버전의 label version
    toMax: number;            // 신버전의 entity 수
  }>;
}
```

### 용도

- 버전 간 shape 변화 파악 (어떤 축이 늘어나거나 줄었는지)
- 마이그레이션 필요성 판단 (changedLabels가 비어있으면 shape 동일)
- capacity 변화에 따른 headroom 분석

## LabelRegistry 버전 관리

소스: `packages/weighted-index/src/vocab/label-registry.ts`

각 레이블(축)은 독립적으로 버전을 관리한다.

### 설계 원칙

- entity ID 순서 = 1-based 인덱스: `ids[0] → 1`, `ids[1] → 2`
- 추가는 끝에만 (append-only) → 기존 인덱스 유지
- `max = ids.length` (자동 도출)
- 버전 간 entity 삭제 없음 → backward compatibility

### 버전 조회 API

| 메서드 | 설명 |
|--------|------|
| `getLatestVersion(label)` | 최신 버전 ID |
| `getVersions(label)` | 전체 버전 목록 (등록 순) |
| `hasVersion(label, version)` | 특정 버전 존재 여부 |
| `getMax(label, version)` | 해당 버전의 entity 수 |
| `getIndex(label, version, entityId)` | entity ID → 1-based 순번 |
| `getEntityId(label, version, index)` | 1-based 순번 → entity ID |

### PrefixVersionEntry

```typescript
interface PrefixVersionEntry {
  version: string;
  labelVersions: Record<string, string>;  // label → LabelRegistry version
}
```

prefix 버전은 각 레이블에서 어떤 label version을 사용할지의 스냅샷이다. shape은 `labelVersions`에서 각 레이블의 max를 모아 동적으로 도출한다.

## HTTP 엔드포인트

```
POST /query-across-versions
  Body: { indexId, versionIds, constraint }
  Response: { "pv1": [[0, 63]], "pv2": [[0, 127]] }
```

`isCurrent(vi)` — 주어진 VersionedIndex가 해당 prefix의 현재(최신) 버전인지 확인하는 편의 메서드.
