---
def:
  tier: component
  id: analysis-transition
  address: def_document:v2:205952
  scope: state
  aspect: domain_state
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [observability]
  links:
    - target: analysis-prefix
      type: depends_on
---
# TransitionSpec — 상태 전이

## 목적 ^purpose

이벤트로 인해 엔티티의 상태가 어떻게 전이되는지를 정의하는 스펙. "이 이벤트로 무엇이 되었는가"에 대한 답.

## 구성 ^overview

TransitionSpec은 raw coordinate system 위에 state semantics를 덧씌우는 해석 계층이다. 좌표 패턴 → 전이 이름 → input/output 바인딩 → effect 구조로 동작한다. 상태는 별도 vocabulary가 아니라 DEMO_CATALOG의 축(axis)으로 표현한다.

### TransitionSpec 구조

```typescript
interface TransitionSpec {
  transition: string;     // 고유 이름. 형식: <domain>.<entity>.<operation>
  version: string;
  match: MatchPattern;    // 좌표 패턴 매칭 규칙
  bind: BindDef;          // raw event에서 identity 추출
  input: InputCondition;  // 전이 전 상태 조건 (축 기반)
  output: OutputMutation; // 전이 후 상태 변경 (축 기반)
  effect: EffectDef;      // 전이의 성격
}
```

### 매칭 모드 (MatchMode)

| 모드 | 설명 | 구현 상태 |
|------|------|----------|
| `single` | 단일 이벤트 매칭 | 구현 완료 |
| `ordered` | 순서 있는 다중 이벤트 | 구현 완료 |
| `unordered` | 순서 없는 다중 이벤트 | 미구현 |
| `windowed` | 시간 윈도우 내 매칭 | 미구현 |

좌표 패턴은 `CoordinatePattern` — DEMO_CATALOG의 축 이름 → 값 매핑이다.

### Effect 6종 (정규 vocabulary)

| Effect | 의미 |
|--------|------|
| `create` | 새 엔티티 생성 |
| `update` | 기존 상태 변경 |
| `move` | 상태 이동 (위치 변경) |
| `consume` | 엔티티 소비/소멸 |
| `open` | 상태 열기 (활성화) |
| `close` | 상태 닫기 (비활성화) |

### 상태 조건과 변경 (축 기반)

**입력 조건 (StateCondition):**
```typescript
{ axis: "lifecycle_state", eq: "active" }     // 정확히 일치
{ axis: "flow_step", neq: "completed" }       // 불일치
{ axis: "lifecycle_state", in: ["active", "pending"] }  // 목록 포함
{ axis: "lifecycle_state", exists: true }     // 값 존재 여부
```

**출력 변경 (StateAssignment):**
```typescript
{ axis: "lifecycle_state", value: "completed" }  // 값 설정
{ axis: "flow_step", value: null }               // 값 제거
```

### TransitionEngine 7단계 파이프라인

```
collect → match → bind → load state → validate input → apply output → emit instance
```

1. **collect** — 이벤트를 timestamp 순으로 정렬
2. **match** — registry의 모든 spec에 대해 좌표 패턴 매칭
3. **bind** — `$.events[N].field_name` 경로로 context_id, resource_id 추출
4. **load state** — StateStore에서 현재 상태 로드
5. **validate input** — 전이 전 조건 검증 (실패 시 InputViolation)
6. **apply output** — 상태 변경 적용 (StateStore에 저장)
7. **emit instance** — TransitionInstance 생성 (deterministic replay 단위)

**중요:** address_context는 디코딩된 축 이름→entry 값 매핑이어야 한다. 인코딩된 prefix 주소가 아님. decode 책임은 호출자에 있다.

### 세션 격리

`createTransitionFunctions(specs)`는 세션마다 fresh `InMemoryStateStore`를 생성한다. registry는 공유(spec 정의는 불변)하되, 상태는 세션별로 격리된다.

### 전이 Metric 3종

`transitionFlushToMetrics()` 함수가 세션 처리 결과에서 metric을 계산한다:

| Metric ID | 이름 | 계산 | 임계값 |
|-----------|------|------|--------|
| `metric:transition:coverage` | 전이 커버리지 | 매칭 spec 수 / 전체 spec 수 × 100 | ≤50 warning, ≤20 critical |
| `metric:transition:violation-rate` | 전이 위반율 | 위반 수 / (위반 + 성공) × 100 | ≥20 warning, ≥50 critical |
| `metric:transition:orphan-sequences` | 미매칭 시퀀스 | unmatched 이벤트가 있는 세션 수 | ≥10 warning, ≥50 critical |

### TransitionRegistry

인메모리 등록/조회. `Map<name, Map<version, TransitionSpec>>` 구조.

- `register(spec)` — 검증 후 등록 (검증 실패 시 ValidationResult 반환)
- `get(name, version?)` — 버전 생략 시 최신 반환
- `getVersions(name)` — 특정 transition의 모든 버전
- `list()` — 등록된 모든 spec

### StateStore — 축 기반 상태 저장소

`context_id + resource_id` 단위로 축(axis)의 현재 entry 값을 저장한다. 별도 slot vocabulary 없이 DEMO_CATALOG 축이 곧 상태 키다.

**동기 인터페이스 (StateStore):**

| 메서드 | 설명 |
|--------|------|
| `get(contextId, resourceId, axis)` | 축 값 읽기. 없으면 `null` |
| `set(contextId, resourceId, axis, value)` | 축 값 설정 |
| `unset(contextId, resourceId, axis)` | 축 값 제거 |
| `snapshot(contextId, resourceId)` | 전체 축 스냅샷 반환 |
| `clear()` | 전체 초기화 |

**구현체 2종:**

| 구현 | 동기/비동기 | 용도 |
|------|------------|------|
| `InMemoryStateStore` | 동기 (`StateStore`) | 세션별 격리, engine.process() 내부 |
| `SqliteStateStore` | 비동기 (`AsyncStateStore`) | 영속 저장. SqlDriver 주입. `transition_state` 테이블 자동 생성 |

SqliteStateStore DDL:
```sql
CREATE TABLE IF NOT EXISTS transition_state (
  context_id  TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  axis        TEXT NOT NULL,
  value       TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  PRIMARY KEY (context_id, resource_id, axis)
);
```

### 2단계 검증 체계

**Tier 1: 구조 검증 (`validateTransitionSpec`)**

catalog 무관. JSON 구조만 검증한다:
- `transition` 이름: `<domain>.<entity>.<operation>` 패턴 (`/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,3}$/`)
- `match.mode`: single, ordered, unordered, windowed 중 하나
- `match.coordinates`: 비어 있지 않은 배열. single일 때 정확히 1개
- `bind`: context_id, resource_id 필수. 경로 형식 `$.events[N].field`
- `input.all[]`: 축 이름 snake_case + 최소 1개 연산자(eq/neq/in/exists)
- `output.set[]`: 축 이름 snake_case + value(string 또는 null)
- `effect.kind`: create/update/move/consume/open/close 중 하나

**Tier 2: 카탈로그 검증 (`validateWithCatalog`)**

catalog를 받아 축/entry가 실제로 존재하는지 검증한다:
- `match.coordinates[].dimension`이 `catalog.axes`에 존재하는지
- `match.coordinates[].value`가 해당 축의 entries에 있는지
- `input.all[].axis`가 `catalog.axes`에 존재하는지
- `input.all[].eq/neq/in` 값이 해당 축의 entries에 있는지
- `output.set[].axis`가 `catalog.axes`에 존재하는지
- `output.set[].value`가 해당 축의 entries에 있는지 (null 제외)

축의 모든 버전에 걸친 전체 entry 집합에서 검색한다 (버전 무관).

### Bind Extractor — identity 추출

`extractBind(bind, events)` 함수가 매칭된 이벤트 배열에서 context_id/resource_id를 추출한다.

경로 형식: `$.events[N].field` 또는 `$.events[N].payload.field` (깊이 2까지).

```typescript
// bind 정의
{ context_id: "$.events[0].context_id", resource_id: "$.events[3].order_id" }

// 매칭 이벤트 4개에서 추출
extractBind(bind, matchedEvents)
// → { ok: true, result: { context_id: "ctx-123", resource_id: "ord-456" } }
```

실패 시 `{ ok: false, errors: BindError[] }` 반환. 에러 사유: 경로 형식 오류, 인덱스 범위 초과, 필드 미존재, 타입 불일치.

### Decode Adapter — address_context 디코딩

`decodeAddressContext(catalog, encoded)` 함수가 인코딩된 address_context를 디코딩한다.

```
입력: { "tracking": "tracking:v2:42", "flow_point": "flow_point:v1:15" }
출력: { "trackAction": "submit", "page": "checkout", "flow_name": "checkout", "flow_step": "entry", ... }
```

- `parseSerializedAddress` + `decodePrefixAsResult` 사용
- **axis 차원만 포함** — prefix_ref/table_ref는 건너뜀
- axisId가 label과 다르면 양쪽 모두 매핑 (TransitionSpec 호환)
- decode 실패 시 해당 prefix skip (에러 격리)

### Match Adapter — ScenarioStep 변환

TransitionSpec의 `MatchPattern`을 기존 engine의 `ScenarioStep[]`으로 변환하는 어댑터.

| 함수 | 설명 |
|------|------|
| `deriveEventKey(coord)` | CoordinatePattern → event_key (차원 값을 `.`으로 연결, 정렬된 키 순서) |
| `coordToConstraints(coord)` | CoordinatePattern → StepConstraint[] (`address_context.{dim}` eq 제약) |
| `transitionMatchToScenarioSteps(match, name)` | MatchPattern → ScenarioStep[] (single→단일 step, ordered→순차 steps with next 연결) |

### DKG Bridge — TransitionSpec → DKG 노드/엣지 파생

TransitionSpec이 SSOT. DKG 노드와 엣지는 파생이다.

**노드 파생 (`toTransitionSpecNode`):**
- 축 참조를 역할별로 분리: `matchAxes` / `inputAxes` / `outputAxes`
- ID 형식: `TSPEC-<transition의 . → - 변환>` (예: `TSPEC-cart-checkout`)
- `slotRefs` = 전체 합집합 (matchAxes ∪ inputAxes ∪ outputAxes)

**상태 의존성 엣지 (`deriveInterSpecEdges`):**
- A.outputAxes ∩ B.inputAxes가 비어 있지 않으면 → B `depends-on` A
- 의미: B가 A의 output을 전제조건으로 요구

**DSL satisfies 엣지 (`deriveDslSatisfiesEdges`):**
- TransitionSpec의 slotRefs와 DSL 축 교집합이 2개 이상이면 → spec `satisfies` DSL
- DSL 축은 `dsl-bundle → contains → prefix → composes → axis` 경로로 수집

### 위반 → Observation 변환

`violationsToObservations()` 함수가 InputViolation을 DKG ObservationNode로 변환한다.

- transition별 그룹핑
- ID: `OBS-TRANSITION-{name}-{date}` (날짜 단위 멱등)
- subjects: `[TSPEC-{name}, ...violatedAxes]`
- intent: 항상 `"action-needed"` (metricsToObservations 패턴과 대칭)

### Demo TransitionSpec 32종

DEMO_CATALOG 기반 예시 spec이 `DEMO_TRANSITION_SPECS` 배열로 제공된다.

| 카테고리 | spec 이름 | mode | effect |
|----------|-----------|------|--------|
| shop-web | cart.checkout, user.login, payment.capture | ordered | create, open, close |
| infra | deploy.rollout, deploy.degraded, pipeline.ingest | ordered | update, update, create |
| dev | build.success | ordered | create |
| 관측 | permission.grant, pattern.anomaly | single, ordered | update, open |
| commerce | cart.add, event.emit | single | update, create |
| content | content.publish | single | update |
| auth | rbac.assign | single | update |
| dkg | dkg.operate, dkg.decide, dkg.observe | single | create, create, open |
| cli | cli.execute | single | consume |
| pipeline | schema.validate, data.mask | ordered, single | create, update |
| pattern | pattern.classify, pattern.severity | single | create, update |
| relational | relational.bind | single | create |
| skill | skill.execute | single | close |
| engine | engine.evaluate, schema.migrate, contract.check | single | close, update, close |
| build | build.package | ordered | create |
| metric | metric.record | single | consume |
| dkg ext. | edge.activity, gate.check | single | update, consume |
| event/exec | event.classify, execution.replay | single | update, consume |

주요 상태 축: `lifecycle_state`(생명주기), `flow_step`(흐름 위치), `health_status`(건강 상태), `version_lifecycle`(버전 단계), `resource_location`(자원 위치).

### TransitionPipeline — convergence 통합

`createTransitionFunctions(specs)` 팩토리가 convergence pipeline에 주입되는 함수 번들을 생성한다.

```typescript
interface TransitionFunctions {
  processSession(input: TransitionSessionInput): TransitionSessionResult;
  violationsToObs(violations, opts?): ObservationNode[];
  decodeCtx(catalog, encoded): Record<string, string>;
  specs: readonly TransitionSpec[];
}
```

**TransitionFlushResult** — tier-3 수렴 metric 입력:
- `coverageRate`: 매칭된 spec 수 / 전체 spec 수
- `violationRate`: 위반 수 / (위반 + 성공)
- `orphanSequences`: unmatched 이벤트가 있는 세션 수

`aggregateTransitionResults(results, totalSpecs)` 함수가 세션 결과 배열에서 FlushResult를 집계하고, `transitionFlushToMetrics(flush)` 함수가 MetricValue 3종으로 변환한다.

## 관련 소스

| 파일 | 역할 |
|------|------|
| `packages/spec-core/src/transition/transition.types.ts` | 타입 정의 (TransitionSpec, MatchPattern, StateCondition 등) |
| `packages/spec-core/src/transition/transition-engine.ts` | 7단계 파이프라인 (TransitionEngine, TransitionResult) |
| `packages/spec-core/src/transition/transition.registry.ts` | 인메모리 레지스트리 (Map<name, Map<version, spec>>) |
| `packages/spec-core/src/transition/transition.schema.ts` | Tier 1 구조 검증 (validateTransitionSpec) |
| `packages/spec-core/src/transition/catalog-validator.ts` | Tier 2 카탈로그 검증 (validateWithCatalog) |
| `packages/spec-core/src/transition/state-store.ts` | StateStore 인터페이스 + InMemoryStateStore |
| `packages/spec-core/src/transition/sqlite-state-store.ts` | SqliteStateStore (AsyncStateStore) |
| `packages/spec-core/src/transition/bind-extractor.ts` | 이벤트에서 identity 추출 (extractBind) |
| `packages/spec-core/src/transition/input-validator.ts` | 축 기준 상태 조건 검증 (validateInput) |
| `packages/spec-core/src/transition/output-applier.ts` | 축 entry 변경 적용 (applyOutput) |
| `packages/spec-core/src/transition/match-adapter.ts` | MatchPattern → ScenarioStep 변환 |
| `packages/spec-core/src/transition/decode-adapter.ts` | address_context 디코딩 어댑터 |
| `packages/spec-core/src/transition/dkg-bridge.ts` | DKG 노드/엣지 파생 |
| `packages/spec-core/src/transition/violation-bridge.ts` | 위반 → ObservationNode 변환 |
| `packages/spec-core/src/transition/transition-pipeline.ts` | convergence 통합 팩토리 |
| `packages/spec-core/src/transition/transition-metrics.ts` | metric 계산 (coverage, violation-rate, orphan-sequences) |
| `packages/spec-core/src/transition/demo-transition-specs.ts` | 데모 spec 32종 |
