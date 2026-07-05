# Query — 조회 + 순회

> `src/query/` 모듈 spec. v0.2~v0.3에서 추가. 라이브러리 API 상세는 [api-surface.md](../api-surface.md) 참조.

## 정의

Taxonomy IR을 입력으로 받아 **entry, coordinate, relation을 조회/순회**하는 순수 함수 집합. I/O 없음, throw 없음 (fail-open).

## 목적 ^purpose

검증된 taxonomy IR을 사람이 쓰는 ref, axis slice, relation traversal, coordinate traversal로 안전하게 탐색한다.

## 함수

### `show`

```typescript
function show(ref: string, registry: TaxonomyRegistry): RefResult | undefined
```

**의도**: 3-tier ref 문자열 하나로 taxonomy IR의 임의 노드를 조회.

**동작**
1. `parseRef(ref)` → `TaxonomyRef` 구조체
2. `resolveRef(ref, registry)` → IR 내 해당 위치 값 추출
3. 실패(taxonomy 없음, entry 없음 등) → `undefined` 반환 (throw 안 함)

**입력**: 3-tier ref 문자열 (`Tier 1 / Tier 2 / Tier 3` 모두 수용)
**출력**: `RefResult` (해당 노드의 IR 값 + meta) 또는 `undefined`

**사용 예시**
```typescript
const reg = new TaxonomyRegistry()
reg.add(parse(yamlText).ir)

// Tier 2 (dotted shorthand)
const entry = show('qa-sdk-coordinate-system:scope.apm', reg)
// entry.kind === 'entry', entry.value.id === 'apm'

// Tier 1 (JSON pointer)
const axis = show('qa-sdk-coordinate-system#/axes/scope', reg)

// Tier 3 (address)
const byAddr = show('qa-sdk-coordinate-system::scope#0', reg)
// Tier 1과 Tier 3 결과 동일
```

**참조**: [reference-grammar.md](../reference-grammar.md) §5.1, [api-surface.md](../api-surface.md)
**추가 버전**: v0.2 (T-A1)

---

### `slice`

```typescript
function slice(ir: TaxonomyIR, axisName: string, range?: SliceRange): EntryIR[]
```

**의도**: 특정 axis의 entries를 범위로 잘라 반환. pagination 없이 인메모리 필터.

**입력**
- `ir` — parse 결과 IR
- `axisName` — 대상 axis 이름 (예: `"scope"`)
- `range` (선택) — `{ ids?: string[] } | { from?: string; to?: string }`

**출력**: `EntryIR[]` — axis 미존재 시 `[]` 반환 (throw 안 함)

**range 형식**

| 형식 | 예시 | 의미 |
|------|------|------|
| 없음 | `slice(ir, 'scope')` | 전체 entries |
| ids 배열 | `{ ids: ['apm', 'ingest'] }` | 지정 id만 |
| from/to | `{ from: 'apm', to: 'gate' }` | 정의 순서 기준 범위 |

**사용 예시**
```typescript
// scope axis의 처음 4개 entries
const entries = slice(ir, 'scope', { from: 'apm', to: 'gate' })

// 특정 id만
const subset = slice(ir, 'aspect', { ids: ['model', 'runtime'] })
```

**추가 버전**: v0.2 (T-B1)

---

### `walkRelation`

```typescript
function walkRelation(
  ir: TaxonomyIR,
  relName: string,
  startId: string
): IterableIterator<string>
```

**의도**: entry id에서 출발해 relation graph를 DFS 순회. entry id를 순서대로 yield.

**입력**
- `ir` — parse 결과 IR
- `relName` — 대상 relation 이름 (예: `"depth-contains"`)
- `startId` — 시작 entry id

**출력**: `IterableIterator<string>` — 방문한 entry id들 (startId 포함)

**순환 방지**: visited Set으로 이미 방문한 id 건너뜀.

**사용 예시**
```typescript
// depth axis에서 overview에서 시작해 depth-contains 관계를 따라 순회
const ids = [...walkRelation(ir, 'depth-contains', 'overview')]
// ['overview', 'system', 'layer', 'component', 'entry']

// codegen에서 특정 entry 하위 트리만 추출
for (const id of walkRelation(ir, 'depth-contains', 'layer')) {
  console.log(id)  // 'layer', 'component', 'entry'
}
```

**관련 개념**: [relation.md](./relation.md), [entry.md](./entry.md)
**추가 버전**: v0.2 (T-B1)

---

### `walkByCoordinate`

```typescript
function walkByCoordinate(
  ir: TaxonomyIR,
  relName: string,
  startCoord: Coordinate
): IterableIterator<Coordinate>
```

**의도**: 좌표점에서 출발해 relation graph를 DFS 순회. cross-axis 흐름 추적. `walkRelation`의 coordinate-aware 버전.

**입력**
- `ir` — parse 결과 IR
- `relName` — 대상 relation 이름
- `startCoord` — 시작 좌표점 `{ [axisName: string]: string }`

**출력**: `IterableIterator<Coordinate>` — 방문한 좌표점들 (startCoord 포함)

**순환 방지**: visited Set — packed coordinate를 key로 사용.

**`walkRelation`과의 차이**

| | `walkRelation` | `walkByCoordinate` |
|---|---|---|
| 입력 단위 | entry id | Coordinate (다축 점) |
| 출력 단위 | entry id | Coordinate |
| cross-axis 흐름 | 불가 | 가능 |
| 순환 감지 키 | entry id | packed coordinate |

**사용 예시**
```typescript
// lesson-builder: Clip → Asset.controlParams 흐름 추적
const start: Coordinate = { layer: 'clip', paramKind: 'control' }
for (const coord of walkByCoordinate(ir, 'clip-binds-asset', start)) {
  console.log(coord)
  // { layer: 'asset', paramKind: 'control', ... }
}

// qa-sdk 좌표계: aspect parent 체인 추적
const start: Coordinate = { aspect: 'runtime' }
const chain = [...walkByCoordinate(ir, 'aspect-parents', start)]
// [{ aspect: 'runtime' }, { aspect: 'protocol' }, { aspect: 'model' }]
```

**관련 개념**: [coordinate.md](./coordinate.md), [relation.md](./relation.md)
**추가 버전**: v0.3 (T-E1)

## 다른 개념과의 관계

- [axis.md](./axis.md) — `slice`의 대상 단위
- [entry.md](./entry.md) — `walkRelation`이 yield하는 단위
- [coordinate.md](./coordinate.md) — `walkByCoordinate`가 yield하는 단위
- [relation.md](./relation.md) — walk 함수들이 따라가는 규칙

## 참조

- 코드 위치: `packages/taxonomy-engine/src/query/index.ts`
- API 진입: `packages/taxonomy-engine/src/index.ts`
- 테스트: `packages/taxonomy-engine/__tests__/unit/query.test.ts`
- v0.2 계획: [plans/v0.2.md](../plans/v0.2.md) §T-B1, T-A1
- v0.3 계획: [plans/v0.3.md](../plans/v0.3.md) §T-E1
