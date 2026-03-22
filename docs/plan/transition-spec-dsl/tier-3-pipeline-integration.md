# Tier 3 — 파이프라인 통합 + 수렴 + DKG

> ingest Phase 2.5 삽입 + 수렴 metric + effect vocabulary DKG 관리.
> 검증 후 도입. Tier 1+2 안정화 필수.

## 선행 조건

- Tier 1 완료 (타입 + 스키마)
- Tier 2 완료 (State Slot + Engine)
- Tier 2의 deterministic replay 테스트 통과

## 목표

- ingest-server Phase 2 후단에 transition matching 삽입
- effect vocabulary를 DKG constraint로 관리
- 수렴 분석에 transition 건전성 metric 추가
- transition 기반 상태 질의 API
- CLI 통합

## 1. Ingest Pipeline 통합

### Phase 2.5: Transition Matching

현재 Phase 2 파이프라인:

```
Phase 2.1: Reconstruction (EventRecord[] → RuntimeGraph)
Phase 2.2: Metric Aggregation
Phase 2.3: Verdict (ScenarioSpec 적용)
Phase 2.4: Convergence Notification
```

Tier 3 후:

```
Phase 2.1: Reconstruction
Phase 2.2: Metric Aggregation
Phase 2.3: Verdict
Phase 2.5: Transition Matching (NEW)  ← verdict 후, convergence 전
Phase 2.6: Convergence Notification (transition 결과 포함)
```

### Phase 2.5 구현

```typescript
// phase-two-worker.ts에 추가
async function phaseTransitionMatching(
  events: EventRecord[],
  engine: TransitionEngine,
): Promise<TransitionResult> {
  const result = engine.process(events)

  // TransitionInstance를 store에 기록
  for (const instance of result.instances) {
    await transitionStore.save(instance)
  }

  // input violation은 observation으로 변환
  for (const violation of result.violations) {
    await emitTransitionViolationObservation(violation)
  }

  return result
}
```

### 에러 격리 원칙

기존 convergence pipeline과 동일한 원칙:
- transition matching 실패가 verdict를 차단하지 않음
- violation은 observation으로 기록 (fail-open)
- `TRANSITION_ENGINE_ENABLED=true` 환경변수로 게이팅

## 2. Effect Vocabulary DKG 관리

### EffectVocabulary Constraint

```typescript
const EFFECT_VOCABULARY_CONSTRAINT: ConstraintNode = {
  id: 'CON-EFFECT-VOCAB',
  kind: 'Constraint',
  data: {
    type: 'vocabulary',
    target: 'transition.effect.kind',
    allowed: ['create', 'update', 'move', 'consume', 'open', 'close'],
    description: 'Transition effect는 정규 vocabulary만 허용',
  }
}
```

새 effect kind 추가 절차:
1. DKG Decision 생성 (왜 필요한지)
2. Constraint 업데이트
3. 타입 + 스키마 반영
4. DKG VersionEvent 기록

### Effect → Signal Role 매핑

| effect | signal role | 의미 |
|--------|-------------|------|
| create | effect | 새 자원 생성 |
| update | state | 기존 자원 변경 |
| move | effect | 위치 이동 |
| consume | data | 자원 소비/읽기 |
| open | state | 흐름 시작 |
| close | state | 흐름 종료 |

## 3. 수렴 분석 — Transition Metric

### 신규 metric 3종

#### transition_coverage

정의된 transition spec 중 실제 매칭된 비율.

```typescript
interface TransitionCoverageMetric {
  id: 'transition_coverage'
  total_specs: number
  matched_specs: number
  coverage_ratio: number  // 0.0 ~ 1.0
  unmatched: string[]     // 매칭 0회인 transition 이름
}
```

임계값:
- `>= 0.8` → ok
- `>= 0.5` → warning
- `< 0.5` → issue (대부분의 spec이 죽어있음)

#### orphan_sequence

transition spec 없이 반복되는 좌표 패턴.

```typescript
interface OrphanSequenceMetric {
  id: 'orphan_sequence'
  patterns: Array<{
    coordinates: string[]  // 반복된 좌표 시퀀스
    frequency: number      // 발생 횟수
    suggestion: string     // "transition spec 추가 권장"
  }>
}
```

수렴 분석의 `boundary-recommender`와 연동:
- orphan sequence가 충분히 반복되면 새 transition spec 추천

#### input_violation_rate

input 조건 실패 빈도.

```typescript
interface InputViolationMetric {
  id: 'input_violation_rate'
  total_attempts: number
  violations: number
  rate: number  // violations / total_attempts
  top_violations: Array<{
    transition: string
    slot: string
    count: number
  }>
}
```

임계값:
- `<= 0.05` → ok (5% 이하)
- `<= 0.2` → warning
- `> 0.2` → issue (spec이 현실과 불일치)

### Convergence Runner 통합

```typescript
// convergence-runner.ts 확장
async function runConvergenceAnalysis(catalog, graph, options) {
  // 기존 5개 서비스
  const existing = await runExistingServices(...)

  // transition metric 추가 (옵션)
  if (options.transitionEngine) {
    const transitionMetrics = await collectTransitionMetrics(
      options.transitionEngine,
      catalog,
    )
    existing.metrics.push(...transitionMetrics)
  }

  return existing
}
```

## 4. 상태 질의 API

### query-service 확장

```
GET /state/:contextId/:resourceId
  → 현재 slot 스냅샷

GET /state/:contextId/:resourceId/history
  → transition instance 이력 (시간순)

GET /state/:contextId/:resourceId/at?timestamp=<ISO>
  → 특정 시점의 상태 (replay 기반 재구성)

GET /transitions?context_id=<id>&limit=<n>
  → context별 transition instance 목록
```

`/at?timestamp=` 질의는 deterministic replay로 구현:
- 해당 시점까지의 이벤트만 수집
- engine.process() 실행
- 결과 상태 반환

## 5. CLI 통합

### 신규 명령

```bash
# transition spec 관리
qa-sdk transition list                    # 등록된 spec 목록
qa-sdk transition show <name>             # spec 상세
qa-sdk transition validate <file>         # YAML/JSON spec 검증

# 상태 질의
qa-sdk state show <context_id> <resource_id>          # 현재 상태
qa-sdk state history <context_id> <resource_id>       # 전이 이력
qa-sdk state replay <context_id> <resource_id> --at <timestamp>  # 시점 재구성

# 분석
qa-sdk transition coverage                # transition_coverage metric
qa-sdk transition orphans                 # orphan_sequence 감지
qa-sdk transition violations              # input_violation 통계
```

### CLI 좌표 매핑

`CLI_COMMAND_MAP`에 추가:

| 명령 | intent | domain | subject |
|------|--------|--------|---------|
| transition list | query | transition | spec |
| transition validate | verify | transition | spec |
| state show | query | transition | state |
| state replay | trace | transition | state |
| transition coverage | analyze | transition | metric |

## 6. Dev Dashboard 확장

### Transition View (4번째 탭)

- **Transition List**: 등록된 spec 목록 + 매칭 빈도
- **State Explorer**: context/resource별 현재 slot 상태
- **Violation Log**: input 조건 실패 이력
- **Coverage Heatmap**: transition별 매칭 빈도 시각화

### WebSocket 확장

```json
{
  "type": "transition_update",
  "data": {
    "instance": { ... },
    "state_delta": { "resource.exists": [false, true] }
  }
}
```

## 7. 환경변수

| 변수 | 기본값 | 패키지 | 설명 |
|------|--------|--------|------|
| `TRANSITION_ENGINE_ENABLED` | `false` | ingest-server | Phase 2.5 활성화 |
| `TRANSITION_STORE_PATH` | `:memory:` | ingest-server | TransitionInstance SQLite |
| `TRANSITION_STATE_PATH` | `:memory:` | ingest-server | StateSlotStore SQLite |
| `TRANSITION_VIOLATION_MODE` | `warn` | ingest-server | `strict` = fail, `warn` = observe |

## 8. DKG 자기참조 확장

transition 관련 DKG prefix/축 추가:

```
축: transition_op (match, bind, validate, apply, emit, replay)
축: transition_target (spec, slot, instance, violation)
prefix: transition_event (transition_op × transition_target)
```

`dsl-dev` DSL bundle에 `transition_event` 추가.

## 완료 기준

- [ ] ingest Phase 2.5 삽입 + `TRANSITION_ENGINE_ENABLED` 게이팅
- [ ] 에러 격리 테스트 (transition 실패 → verdict 미영향)
- [ ] Effect vocabulary DKG constraint (CON-EFFECT-VOCAB)
- [ ] 수렴 metric 3종 (coverage, orphan, violation)
- [ ] query-service 상태 질의 API 4개
- [ ] CLI 명령 6개
- [ ] Dev Dashboard Transition View
- [ ] 환경변수 문서화
- [ ] DKG 자기참조 (transition_event prefix)
- [ ] End-to-end: shop-web 이벤트 → transition matching → 상태 재구성

## 리스크

| 리스크 | 완화 |
|--------|------|
| Phase 2.5 레이턴시 증가 | 비동기 처리, 캐시, 필요 시 별도 워커 |
| Slot vocabulary 폭발 | DKG Decision 필수, scope 확장 제한 |
| orphan 감지 false positive | 최소 빈도 임계값 설정 (10회 이상) |
| replay 성능 | 시간 범위 제한, 중간 체크포인트 |

## 의존성

- Tier 1 + Tier 2 완료
- ingest-server (Phase 2 파이프라인)
- query-service (상태 질의 API)
- spec-core/convergence (수렴 분석)
- @qa-sdk/cli (CLI 명령)
- Dev Dashboard (UI 확장)
