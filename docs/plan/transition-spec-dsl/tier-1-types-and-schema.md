# Tier 1 — 타입 + 스키마 + Match/Bind

> 순수 선언 계층. 기존 코드 변경 0. 런타임 엔진 없음.

## 목표

- TransitionSpec의 TypeScript 타입 정의
- JSON Schema 검증
- 인메모리 registry
- DKG에 TransitionSpecNode 추가
- engine의 GraphMatcher 재사용 어댑터

## 파일 구조

```
packages/spec-core/src/transition/
  transition.types.ts      — 핵심 타입 정의
  transition.schema.ts     — JSON Schema 검증
  transition.registry.ts   — Map<name, TransitionSpec[]> 인메모리 등록
  match-adapter.ts         — MatchPattern → ScenarioStep[] 변환
  index.ts                 — public exports
```

## 핵심 타입

### TransitionSpec

```typescript
interface TransitionSpec {
  /** 고유 이름. 형식: <domain>.<entity>.<operation> */
  transition: string
  /** spec 버전. 좌표계 버전과 함께 묶인다 */
  version: string
  /** 좌표 패턴 매칭 규칙 */
  match: MatchPattern
  /** raw event에서 identity 추출 */
  bind: BindDef
  /** 전이 전 상태 조건 */
  input: InputCondition
  /** 전이 후 상태 변경 */
  output: OutputMutation
  /** 전이의 성격 */
  effect: EffectDef
}
```

### MatchPattern

```typescript
interface MatchPattern {
  /** 매칭 모드 */
  mode: 'single' | 'ordered' | 'unordered' | 'windowed'
  /** 좌표 패턴 배열 */
  coordinates: CoordinatePattern[]
  /** windowed 모드 시 시간 범위 (ms) */
  window_ms?: number
}

interface CoordinatePattern {
  /** prefix 차원 이름 → 값 매핑. DEMO_CATALOG의 축 이름 사용 */
  [dimension: string]: string
}
```

1차 버전에서 `mode`는 `single` | `ordered`만 구현한다.

### BindDef

```typescript
interface BindDef {
  /** context 식별자 추출 경로 */
  context_id: string
  /** resource 식별자 추출 경로 */
  resource_id: string
  /** 추가 바인딩 (선택) */
  [key: string]: string
}
```

경로 형식: `$.events[N].field_name` (JSONPath 부분집합)

### InputCondition

```typescript
interface InputCondition {
  /** 모든 조건이 만족해야 함 */
  all: SlotCondition[]
}

interface SlotCondition {
  /** 슬롯 이름 (scope.field 형식) */
  slot: string
  /** 연산자 — 1차 버전은 eq/neq/in/exists */
  eq?: string | number | boolean
  neq?: string | number | boolean
  in?: (string | number)[]
  exists?: boolean
}
```

### OutputMutation

```typescript
interface OutputMutation {
  /** 슬롯 값 설정 — 1차 버전은 set만 */
  set: SlotAssignment[]
}

interface SlotAssignment {
  slot: string
  value: string | number | boolean
}
```

`unset`, `append`, `inc`은 Tier 2에서 추가.

### EffectDef

```typescript
interface EffectDef {
  kind: EffectKind
}

type EffectKind = 'create' | 'update' | 'move' | 'consume' | 'open' | 'close'
```

### TransitionInstance (런타임 결과)

```typescript
interface TransitionInstance {
  transition_name: string
  spec_version: string
  context_id: string
  resource_id: string
  matched_event_ids: string[]
  input_snapshot: Record<string, unknown>
  output_snapshot: Record<string, unknown>
  effect_kind: EffectKind
  matched_at: string  // ISO timestamp
}
```

## Match → Engine 어댑터

engine의 기존 `GraphMatcher`를 재사용한다. 변환은 어댑터 1개로 해결.

```typescript
// match-adapter.ts
function transitionMatchToScenarioSteps(match: MatchPattern): ScenarioStep[] {
  return match.coordinates.map((coord, i) => ({
    event_key: deriveEventKey(coord),  // 좌표 → event_key 매핑
    event_version: 'v1',
    required: true,
    constraints: coordToConstraints(coord),
  }))
}
```

`mode: 'ordered'` → edge type `"sequence"`
`mode: 'single'` → 단일 step, edge 없음

## Transition Registry

```typescript
class TransitionRegistry {
  private specs: Map<string, TransitionSpec[]>  // name → version별 spec

  register(spec: TransitionSpec): void
  get(name: string, version?: string): TransitionSpec | undefined
  list(): TransitionSpec[]
  validate(spec: TransitionSpec): ValidationResult  // JSON Schema 검증
}
```

## DKG 통합

`TransitionSpecNode`를 spec-core의 DKG 노드 타입에 추가.

```typescript
interface TransitionSpecNode extends DkgNode {
  kind: 'TransitionSpec'
  data: {
    transition: string
    version: string
    match_mode: MatchPattern['mode']
    coordinate_count: number
    effect_kind: EffectKind
    slot_refs: string[]  // input/output에서 참조하는 슬롯 목록
  }
}
```

엣지:
- `TransitionSpecNode --consumes--> PrefixNode` (match에서 참조하는 prefix)
- `TransitionSpecNode --binds--> SchemaNode` (bind 대상 스키마)
- `DecisionNode --justifies--> TransitionSpecNode` (왜 이 transition을 정의했는지)

## Naming Convention

```
transition: <domain>.<entity>.<operation>
```

| 예시 | 의미 |
|------|------|
| `article.create` | 기사 생성 |
| `article.publish` | 기사 발행 |
| `user.invite` | 사용자 초대 |
| `payment.capture` | 결제 캡처 |
| `cart.checkout` | 장바구니 체크아웃 |
| `order.complete` | 주문 완료 |

규칙:
- 소문자, `.` 구분
- domain은 DSL bundle 이름과 일치 권장
- operation은 effect kind와 의미적으로 대응

## 완료 기준

- [ ] `transition.types.ts` — 모든 타입 정의 + export
- [ ] `transition.schema.ts` — JSON Schema + validate 함수
- [ ] `transition.registry.ts` — register/get/list/validate
- [ ] `match-adapter.ts` — MatchPattern → ScenarioStep[] 변환
- [ ] DKG `TransitionSpecNode` 노드 타입 추가
- [ ] DEMO_CATALOG 기반 예시 transition spec 3개 (article.create, cart.checkout, payment.capture)
- [ ] 단위 테스트: 타입 검증 + registry CRUD + match 어댑터 변환

## 의존성

- `@qa-sdk/engine` (GraphMatcher, ScenarioStep 타입)
- `spec-core` (DkgNode 타입)
- 없음 (외부 패키지 추가 불필요)
