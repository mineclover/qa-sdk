---
def:
  id: dkg-skill-migrator
  address: def_document:v2:68767
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [migration]
  links:
    - target: dkg-skill-catalog
      type: depends_on
    - target: dkg-node-types
      type: depends_on
    - target: dkg-edge-types
      type: depends_on
---
# inferMigrator — 마이그레이션 추론

## 목적 ^purpose

축/prefix 변경 시 필요한 마이그레이션 경로를 자동 추론하는 skill. 두 버전 간 diff를 분석하여 변환 함수(CoordMigrator)를 생성하거나, 수동 migrator가 필요함을 경고한다.

## 구성 ^overview

6종 마이그레이션 패턴 분류, diff 기반 패턴 매칭, 변환 함수 자동 생성, resolve 기반 문자열 마이그레이션 전략으로 구성된다.

## 입력 타입

소스 위치: `packages/spec-core/src/dkg/skills/infer-migrator.ts`

```typescript
interface DiffInfo {
  readonly fromLabels: readonly string[];
  readonly toLabels: readonly string[];
  readonly changedLabels: readonly {
    readonly label: string;
    readonly fromMax: number;
    readonly toMax: number;
  }[];
}
```

## 6종 마이그레이션 패턴

### identity — 변환 불필요

**조건**: fromLabels와 toLabels가 동일하고, changedLabels가 없거나 모든 max가 증가만 한 경우.

**변환**: `coords => [...coords]` (좌표 복사)

**사례**: capacity 확장, entry 추가. 기존 좌표가 그대로 유효.

### reorder — 차원 순서 변경

**조건**: fromLabels와 toLabels가 같은 집합이지만 순서가 다른 경우. append/remove보다 먼저 검사.

**변환**: `coords => mapping.map(i => coords[i])` — 새 순서에 맞게 재배치

**사례**: dim 순서 최적화. stride 정렬 변경.

### append-dim — 차원 추가

**조건**: toLabels가 fromLabels의 상위 집합이고, fromLabels 순서가 toLabels 내에서 보존되는 경우.

**변환**: 추가된 차원 위치에 defaultValue(기본값 1)를 삽입. 기존 차원은 순서 유지.

**경고**: "기본값이 의미적으로 적절한지 확인 필요"

**사례**: prefix에 새 차원 추가 (dim-add).

### remove-dim — 차원 제거

**조건**: toLabels가 fromLabels의 부분 집합인 경우.

**변환**: 유지되는 차원만 추출. `coords => keepIndices.map(i => coords[i])`

**경고**: 제거된 차원별 "정보 소실" 경고

**사례**: 불필요한 차원 제거.

### composite — 복합 변경

현재 구현에서는 위 패턴에 해당하지 않는 경우 모두 unknown으로 분류.

### unknown — 수동 migrator 필요

**조건**: 위 패턴 중 어느 것에도 해당하지 않는 경우. 또는 max가 감소한 경우.

**변환**: `null` — 자동 변환 불가

**경고**: from/to labels 목록 또는 max 감소 상세

**사례**: entry 재배치를 수반하는 capacity 감소.

## 패턴 매칭 우선순위

```
1. identity  — labels 동일 + max 증가/불변
2. reorder   — labels 같은 집합 + 순서 다름
3. append-dim — toLabels ⊃ fromLabels + 순서 보존
4. remove-dim — toLabels ⊂ fromLabels
5. unknown   — 위 모두 불일치 또는 max 감소
```

## 출력 타입

```typescript
interface InferredMigrator {
  readonly pattern: MigratorPattern;
  readonly migrator: ((coords: number[]) => number[]) | null;
  readonly description: string;
  readonly warnings?: readonly string[];
}

type MigratorPattern =
  | "identity" | "append-dim" | "remove-dim"
  | "reorder" | "composite" | "unknown";
```

## resolve 기반 마이그레이션

소스 위치: `packages/spec-core/src/dkg/resolve.ts`

좌표 시스템의 문자열이 영구 고정이므로, `resolve()` 함수가 decode → re-encode 전략으로 항상 마이그레이션 가능.

```
구버전 주소 → decodePrefix(oldVersion) → 문자열 값 추출 → encodePrefixByValue(latestVersion) → 최신 주소
```

- `inferMigrator`는 좌표(숫자 배열) 수준의 변환 함수를 추론
- `resolve`는 직렬화된 주소(문자열) 수준의 마이그레이션 수행
- 두 전략은 상호 보완적: inferMigrator가 unknown이어도 resolve는 성공 가능

## analyzeImpact와의 관계

`analyzeImpact`의 `autoMigratable` 필드가 true이면 inferMigrator로 자동 변환 가능.

| 변경 유형 | autoMigratable | inferMigrator 패턴 |
|-----------|---------------|-------------------|
| entry-added | true | identity |
| capacity-changed | true | identity |
| dim-added | false | append-dim |
| ref-changed | false | unknown |
| entry-deactivated | false | unknown (max 감소 가능) |

## 설계 원칙

- `inferMigrator`는 순수 함수 — 그래프/카탈로그 의존 없음. DiffInfo만 받음
- unknown일 때 migrator를 null로 반환하여 호출자가 수동 처리하도록 강제
- 경고(warnings)로 주의사항을 구조적으로 전달
- 문자열 영구 고정이 DSL DB의 마이그레이션 전략의 근간
