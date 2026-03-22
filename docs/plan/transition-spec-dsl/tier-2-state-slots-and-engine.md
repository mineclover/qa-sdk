# Tier 2 — 축 기반 상태 + Transition Engine

> 상태를 별도 vocabulary가 아닌 DEMO_CATALOG 축으로 표현.
> match→bind→load→validate→apply→emit 7단계 파이프라인.
> 시스템의 성격이 바뀌는 지점: 관찰 → 관찰 + 상태 재구성.

## 선행 조건

- Tier 1 완료 (타입 + 스키마 + registry + match 어댑터)
- input/output이 축(axis) 기반으로 전환 완료

## 핵심 설계 결정

### 상태 = 축의 entry

별도 slot vocabulary를 만들지 않는다. 상태는 DEMO_CATALOG의 축으로 표현한다.

| 용도 | 축 | 비고 |
|------|---|------|
| 흐름 위치 | `flow_step` | entry → processing → success |
| 자원 생명주기 | `lifecycle_state` | draft → active → deprecated |
| 자원 위치 | `resource_location` **(신설)** | origin, cache, queue, external |
| 버전 단계 | `version_lifecycle` | draft → locked → released |
| 존재 여부 | `lifecycle_state` 유무 | exists: false = lifecycle_state 미설정 |
| 소유자 | table_ref (`members`) | 기존 패턴 |

### resource_location 축 신설

```typescript
resource_location: {
  id: "resource_location",
  versions: {
    v1: {
      entries: ["origin", "cache", "queue", "external"],
      capacity: 8,
      ko: {
        origin: "원본",
        cache: "캐시",
        queue: "큐",
        external: "외부",
      },
    },
  },
}
```

5Q 충족: 유한(4종) / 의사결정(읽기 경로 분기) / 공유(여러 prefix) / 안정(인프라 유형) / capacity 8

### 검증이 공짜

축 이름이 catalog에 존재하는지, entry 값이 해당 축에 유효한지 catalog 기반 자동 검증.
Tier 1의 구조 검증(snake_case 형식) + Tier 2의 catalog 검증(실제 축/entry 존재) = 2단계 검증.

## 파일 구조

```
packages/spec-core/src/transition/
  state-store.ts           — StateStore (축 기반 상태 저장)
  input-validator.ts       — input 조건 검증 (축 entry 기준)
  output-applier.ts        — output 상태 변경 (축 entry 설정)
  bind-extractor.ts        — bind 경로로 값 추출
  transition-engine.ts     — 7단계 파이프라인
  catalog-validator.ts     — catalog 기반 축/entry 검증 (선택적)
```

## 1. StateStore (축 기반)

```typescript
interface StateStore {
  /** 특정 context+resource의 축 값 읽기 */
  get(contextId: string, resourceId: string, axis: string): string | null;

  /** 축 값 설정 */
  set(contextId: string, resourceId: string, axis: string, value: string): void;

  /** 축 값 제거 */
  unset(contextId: string, resourceId: string, axis: string): void;

  /** 특정 context+resource의 전체 축 스냅샷 */
  snapshot(contextId: string, resourceId: string): Record<string, string>;
}
```

키 구조: `Map<"contextId:resourceId", Map<axisId, entryValue>>`

### 저장소 구현

| 구현 | 용도 | 키 |
|------|------|---|
| `InMemoryStateStore` | 개발/테스트/replay | `Map<string, Map<string, string>>` |
| `SqliteStateStore` | 영속 분석 | index-meta 드라이버 재사용 |

SQLite 스키마:

```sql
CREATE TABLE transition_state (
  context_id  TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  axis        TEXT NOT NULL,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (context_id, resource_id, axis)
);
```

## 2. Catalog Validator (선택적 2단계 검증)

```typescript
/** catalog를 받아 축 이름/entry 유효성 검증 */
function validateWithCatalog(
  spec: TransitionSpec,
  catalog: Catalog,
): ValidationResult {
  // input.all[].axis가 catalog.axes에 존재하는지
  // input.all[].eq/neq/in 값이 해당 축의 entries에 있는지
  // output.set[].axis가 catalog.axes에 존재하는지
  // output.set[].value가 해당 축의 entries에 있는지
}
```

- Tier 1의 `validateTransitionSpec`(구조 검증)과 분리
- catalog 없이도 동작 가능 (테스트 시)
- catalog 있으면 더 엄격한 검증

## 3. Transition Engine — 7단계 파이프라인

```
raw events
→ 1. collect     — 이벤트 수집
→ 2. match       — spec의 match로 좌표 패턴 매칭
→ 3. bind        — context_id, resource_id 추출
→ 4. load state  — StateStore에서 현재 축 스냅샷 로드
→ 5. validate    — input 조건 검증 (축 entry 기준)
→ 6. apply       — output 적용 (축 entry 설정)
→ 7. emit        — TransitionInstance 생성
```

### 인터페이스

```typescript
interface TransitionEngine {
  process(events: EventRecord[]): TransitionResult;
  readonly registry: TransitionRegistry;
  readonly store: StateStore;
}

interface TransitionResult {
  instances: TransitionInstance[];
  unmatched_events: string[];
  violations: InputViolation[];
}

interface InputViolation {
  transition: string;
  context_id: string;
  resource_id: string;
  axis: string;           // 축 이름
  expected: string | null; // 기대 entry
  actual: string | null;   // 실제 entry
}
```

### Step 5: Validate Input

```typescript
function validateInput(
  input: InputCondition,
  snapshot: Record<string, string>,
): { valid: boolean; violations: InputViolation[] }
```

연산자 의미:
- `eq: "active"` — 해당 축의 현재 값이 "active"
- `neq: "archived"` — "archived"가 아님
- `in: ["active", "draft"]` — 목록 중 하나
- `exists: false` — 해당 축에 값이 설정되지 않음 (자원 미생성)
- `exists: true` — 해당 축에 값이 존재 (자원 존재)

### Step 6: Apply Output

```typescript
function applyOutput(
  output: OutputMutation,
  store: StateStore,
  contextId: string,
  resourceId: string,
): Record<string, string>  // 적용 후 스냅샷
```

- `value: "processing"` → `store.set(ctx, res, "flow_step", "processing")`
- `value: null` → `store.unset(ctx, res, "flow_step")` (축 값 제거)

### Bind Extractor

```typescript
function extractBind(
  bind: BindDef,
  events: EventRecord[],
): { context_id: string; resource_id: string; [key: string]: string }
```

경로 문법 (제한적):
- `$.events[N].field` — N번째 매칭 이벤트의 필드
- `$.events[N].payload.field` — payload 내 필드
- 깊이 2까지만

## 4. Deterministic Replay

핵심 가치: **같은 이벤트 시퀀스 → 같은 상태.**

```typescript
// 같은 이벤트를 2번 replay → 같은 최종 상태
const result1 = engine.process(events);
store.clear();
const result2 = engine.process(events);
assert.deepEqual(
  store.snapshot(ctxId, resId),
  previousSnapshot,
);
```

보장 방법:
- 이벤트는 timestamp 순 정렬 후 처리
- 축 변경은 순차 적용
- bind 경로는 결정적

## 5. 시스템 성격 변화

| | Tier 1까지 | Tier 2 이후 |
|--|-----------|------------|
| 상태 표현 | 없음 | 축 entry 조합 |
| 질문 | "무슨 일이 일어났는가?" | "무슨 상태가 되었는가?" |
| 출력 | 매칭 결과 | 축별 상태 스냅샷 |
| 용도 | spec 정의/검증 | 상태 재구성 + 시점 질의 |
| 검증 | 구조 검증 | 구조 + catalog 축/entry 검증 |

## 완료 기준

- [ ] `resource_location` 축 DEMO_CATALOG에 추가 (entries: origin, cache, queue, external)
- [ ] `state-store.ts` — InMemoryStateStore (+ SqliteStateStore 선택)
- [ ] `catalog-validator.ts` — catalog 기반 축/entry 검증
- [ ] `input-validator.ts` — eq/neq/in/exists 연산자 (축 entry 기준)
- [ ] `output-applier.ts` — set/unset 연산 (축 entry 설정/제거)
- [ ] `bind-extractor.ts` — 제한된 경로 추출
- [ ] `transition-engine.ts` — 7단계 파이프라인
- [ ] deterministic replay 테스트 (같은 입력 → 같은 축 상태)
- [ ] DEMO_CATALOG 기반 end-to-end 테스트 (cart.checkout → payment.capture 연쇄)
- [ ] DKG Decision 기록 (resource_location 축 신설 근거)

## 의존성

- Tier 1 (타입 + 스키마 + registry + match 어댑터)
- `@qa-sdk/engine` (GraphMatcher)
- `@qa-sdk/core` (Catalog 타입, catalog 검증 시)
- `demo-snapshot` (DEMO_CATALOG, resource_location 축 추가)
- index-meta SQLite 드라이버 (SqliteStateStore용, 선택)
