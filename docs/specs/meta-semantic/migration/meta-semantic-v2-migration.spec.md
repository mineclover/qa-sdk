---
def:
  id: meta-semantic-v2-migration
  level: leaf
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: domain
  tags: [entry-point]
  links:
    - target: meta-semantic-system
      type: depends_on
---

# Meta-Semantic v2 마이그레이션 계획

## 목적 ^purpose

기존 qa-sdk 체계를 meta-semantic 기반 v2로 전환하는 마이그레이션 계획.
기존에서 가져올 것, 재설계할 것, 새로 만들 것을 판별하고 단계별 전환 경로를 정의한다.

## 방법 ^method

**1단계**에서 기존 체계를 유지한 채 meta-semantic 기반을 구축하고,
**2단계**에서 ScenarioSpec → 파이프 기반으로 재설계하고,
**3단계**에서 매칭/판정 엔진을 경로 모델로 전환하고,
**4단계**에서 표준 호환(CloudEvents, AsyncAPI)을 적용한다.

---

## 1. 판별 매트릭스

### 가져옴 (그대로 사용)

| 구현 | 패키지 | 이유 |
|------|--------|------|
| EventRecord | @qa-sdk/core | 이벤트 포맷 유지. CloudEvents 확장만 추가 |
| autoTrack | event-catalog | 이벤트 발행 DX 유지 |
| RecordStore (append-only) | @qa-sdk/store | 저장 패턴 유지 |
| convergence pipeline | ingest-server | 집계/분석 유지 |
| registry-service | registry-server | 서비스/prefix 등록. 매니페스트 통합 대상 |
| TransmissionEnvelope | @qa-sdk/core | 배치 전송 구조 유지 |

### 재설계 (v2로 전환)

| 구현 | 현재 | v2 | 변경 이유 |
|------|------|-----|----------|
| **ScenarioSpec** | step kinds (sequence/branch/optional) | **파이프 + 패싯 흐름 제어** | 이벤트 매칭 관점 → 데이터 흐름 관점 |
| **SpecGraph ↔ RuntimeGraph** | 전곱 그래프 매칭 | **경로 모델 기반 매칭** | 도달 가능 경로만 매칭 |
| **VerdictReport** | 6상태 (pass/fail/warn/degraded/unknown/skipped) | **scope×aspect 검증 전략 기반 판정** | 검증 전략이 판정 기준 공급 |
| **주소 인코딩** | scope×aspect 전곱 (8,192) | **경로 모델 (88)** | ScopeRegistry 구현 완료 |

### 검토 후 결정

| 구현 | 현재 | 검토 사항 |
|------|------|----------|
| 6 cross-loop bridge | 6개 피드백 루프 연결 | 필요한 루프만 유지, 과잉 제거 |
| 11 FSM 상태 머신 | 하네스 통합 관리 | prefix/manifest 라이프사이클로 일부 흡수 |
| DKG (16노드 18엣지) | 설계 지식 그래프 | meta-semantic 개념 체계로 일부 대체 가능 |

### 새로 만듦

| 구현 | 설명 | 의존 |
|------|------|------|
| ScopeRegistry | 경로 모델 인코딩 + 버전 관리 | **완료** (14 tests) |
| ManifestRegistry | prefix + manifest 라이프사이클 | **완료** (16 tests) |
| ASPECT_TO_SCOPES | N:M 소비 모델 | **완료** |
| PipeSpec | ScenarioSpec의 v2 대체 | 2단계 |
| PathMatcher | 경로 모델 기반 매칭 엔진 | 3단계 |
| CloudEvents 변환 | toCloudEvent/fromCloudEvent | 4단계 |
| AsyncAPI 생성기 | manifest + event-catalog → .asyncapi.yaml | 4단계 |

---

## 2. ScenarioSpec → PipeSpec 재설계

### 흐름 제어: 패싯 위에서 재정의

기존 ScenarioSpec의 step kinds를 패싯 흐름 위에서 표현한다.
흐름 제어 자체는 유지하되, 기반이 "이벤트 매칭"에서 "데이터 흐름"으로 바뀐다.

| 카테고리 | 흐름 제어 | 표기 | 의미 | 분기 경로 계산 |
|---|---|---|---|---|
| 기본 | `step` | A | 개별 패싯 실행 | 1 |
| 기본 | `sequence` | A → B | 순차. A 완료 후 B | 곱 (A × B) |
| 분기 | `branch` | A → B \| C | 조건부 분기. B 또는 C | 합 (A×B + A×C) |
| 분기 | `optional` | A → (B)? | 선택적. 있어도 없어도 통과 | +1 (있는 경로 + 없는 경로) |
| 동시성 | `parallel` | A + B | 동시 실행, 전부 완료 대기 | 곱 (A × B) |
| 동시성 | `race` | A \|\| B | 동시 실행, 먼저 완료만 | 합 (A + B) |
| 동시성 | `await` | wait(조건) → B | 조건 충족까지 대기 | B의 경로 수 |
| 내결함 | `retry` | A ↻ (n) | 실패 시 재시도 | A의 경로 수 (재시도 횟수 무관) |
| 내결함 | `fallback` | try(A) catch(B) | 실패 시 대안 | 합 (A + B) |
| 반복 | `loop` | A ↻ until(조건) | 조건 충족까지 반복 | A의 경로 수 (반복 횟수 무관) |
| 트랜잭션 | `compensate` | A ✓→ undo(A) | 후속 실패 시 롤백 | A의 경로 수 + 보상 경로 |
| 비동기 | `emit` | fire(이벤트) | 결과 안 기다리고 발행 | 0 (후속 경로 없음) |

### PipeSpec 구조 (안)

```typescript
interface PipeSpec {
  /** 파이프 식별자 */
  pipeId: string;
  version: string;

  /** 트리거 이벤트 (어떤 이벤트가 이 파이프를 시작하는가) */
  trigger: {
    eventKey: string;
    entryConditions?: Constraint[];  // 기존 ScenarioSpec.entry_conditions 유지
  };

  /** 패싯 흐름 — step/sequence/branch/optional 표현 */
  flow: PipeFlow;

  /** scope×aspect 분류 — 검증 전략 결정 */
  scope: string;
  aspect: string;

  /** 매니페스트 참조 */
  manifestVersion?: string;
}

/** 패싯 흐름 노드 — 12종 흐름 제어 */
type PipeFlow =
  // ── 기본 ──
  | PipeStep        // 개별 패싯 실행
  | PipeSequence    // 순차 (A → B)
  // ── 분기 ──
  | PipeBranch      // 조건부 분기 (A → B | C)
  | PipeOptional    // 선택적 (A → B?)
  // ── 동시성 ──
  | PipeParallel    // 동시 실행 (A + B, 전부 완료 대기)
  | PipeRace        // 경쟁 실행 (A || B, 먼저 완료된 것만)
  | PipeAwait       // 대기 후 실행 (조건 충족까지 대기 → B)
  // ── 내결함 ──
  | PipeRetry       // 실패 시 재시도 (backoff + 최대 횟수)
  | PipeFallback    // 실패 시 대안 실행 (catch → B)
  // ── 반복 ──
  | PipeLoop        // 조건 충족까지 반복
  // ── 트랜잭션 ──
  | PipeCompensate  // 후속 실패 시 선행 롤백 (saga)
  // ── 비동기 발행 ──
  | PipeEmit;       // 결과 안 기다리고 이벤트 발행 (fire-and-forget)

// ── 기본 ──────────────────────────────────────────────

interface PipeStep {
  kind: "step";
  facet: string;          // 생산 | 소비 | 정의 | 관리 | 저장
  eventKey?: string;      // 이 단계에서 발생하는 이벤트 (수집 대상)
  constraints?: Constraint[];
  timeout?: number;
}

interface PipeSequence {
  kind: "sequence";
  steps: PipeFlow[];      // 순차 실행: steps[0] → steps[1] → ...
}

// ── 분기 ──────────────────────────────────────────────

interface PipeBranch {
  kind: "branch";
  condition: string;      // 분기 조건
  paths: PipeFlow[];      // 조건에 따라 하나만 실행
}

interface PipeOptional {
  kind: "optional";
  step: PipeFlow;         // 있으면 매칭, 없어도 통과
}

// ── 동시성 ────────────────────────────────────────────

interface PipeParallel {
  kind: "parallel";
  steps: PipeFlow[];      // 동시 실행, 전부 완료 대기 (Promise.all)
}

interface PipeRace {
  kind: "race";
  steps: PipeFlow[];      // 동시 실행, 먼저 완료된 것만 (Promise.race)
}

interface PipeAwait {
  kind: "await";
  condition: string;      // 대기 조건 (이벤트 발생, 타임아웃, 외부 신호)
  timeout?: number;       // 대기 제한 시간
  then: PipeFlow;         // 조건 충족 후 실행
}

// ── 내결함 ────────────────────────────────────────────

interface PipeRetry {
  kind: "retry";
  step: PipeFlow;         // 재시도 대상
  maxAttempts: number;    // 최대 시도 횟수
  backoff?: number;       // 재시도 간격 (ms). 지수 증가 적용 가능
}

interface PipeFallback {
  kind: "fallback";
  try: PipeFlow;          // 먼저 시도
  catch: PipeFlow;        // 실패 시 대안 실행
}

// ── 반복 ──────────────────────────────────────────────

interface PipeLoop {
  kind: "loop";
  body: PipeFlow;         // 반복 실행할 흐름
  until: string;          // 종료 조건 (조건 충족 시 중단)
  maxIterations?: number; // 무한 루프 방지
}

// ── 트랜잭션 ──────────────────────────────────────────

interface PipeCompensate {
  kind: "compensate";
  forward: PipeFlow;      // 정상 흐름
  compensate: PipeFlow;   // forward의 후속이 실패하면 롤백 실행
}

// ── 비동기 발행 ───────────────────────────────────────

interface PipeEmit {
  kind: "emit";
  eventKey: string;       // 발행할 이벤트
  payload?: string;       // 페이로드 표현식
  // 결과를 기다리지 않음 (fire-and-forget)
}
```

### 기존 ScenarioSpec → PipeSpec 변환

```
ScenarioSpec {
  steps: [
    { event_key: "order_submit", kind: "sequence", constraints: [...] },
    { event_key: "payment_process", kind: "sequence", constraints: [...] },
    { event_key: "notification_send", kind: "optional", constraints: [...] },
  ]
}

→ PipeSpec {
  trigger: { eventKey: "order_submit" },
  flow: {
    kind: "sequence",
    steps: [
      { kind: "step", facet: "소비", eventKey: "order_submit", constraints: [...] },
      { kind: "step", facet: "관리", eventKey: "payment_process", constraints: [...] },
      { kind: "optional", step:
        { kind: "step", facet: "생산", eventKey: "notification_send", constraints: [...] }
      },
    ]
  }
}
```

---

## 3. 매칭 엔진 전환: 그래프 → 경로

### 현재: SpecGraph ↔ RuntimeGraph

```
SpecGraph (기대):    step1 → step2 → step3
RuntimeGraph (실제): event_a → event_b → event_c
매칭: greedy first-match per step
```

### v2: 경로 모델 매칭

```
PipeSpec 경로:
  sequence: 소비 → 관리 → 생산 → 저장 (곱: 1 경로)
  branch: 소비 → (관리A | 관리B) (합: 2 경로)
  → 총 경로 수 = 도달 가능 경로만

수집된 이벤트:
  event1 (소비) → event2 (관리A) → event3 (생산) → event4 (저장)
  → 매칭: 경로 1과 일치

판정:
  경로 일치 + constraints 통과 + 타임아웃 이내 → pass
  경로 일치 + constraints 실패 → fail
  경로 불일치 → fail
  optional 경로 누락 → warn
```

---

## 4. 마이그레이션 단계

### Phase 1: 기반 구축 (완료)

| 항목 | 상태 |
|------|------|
| 9개 원자 개념 정의 | ✓ |
| ScopeRegistry (경로 모델 인코딩) | ✓ 14 tests |
| ManifestRegistry (prefix/manifest 라이프사이클) | ✓ 16 tests |
| ASPECT_TO_SCOPES (N:M) | ✓ |
| CloudEvents 매핑 스펙 | ✓ |
| 라이프사이클 정의 | ✓ |

### Phase 2: PipeSpec 설계 + 구현

| 항목 | 설명 |
|------|------|
| PipeSpec 타입 정의 | PipeFlow (step/sequence/branch/optional) |
| ScenarioSpec → PipeSpec 변환기 | 기존 시나리오 마이그레이션 |
| PipeSpec CRUD | ScenarioSpecStore와 동일 패턴 |
| 패싯 흐름 + 흐름 제어 검증 | PipeSpec 유효성 검증 |

### Phase 3: 런타임 실행 + 매칭 엔진

> 상세: `meta-semantic-execution-semantics` 참조

| 항목 | 설명 |
|------|------|
| ConditionEvaluator | 조건 표현식 평가 엔진 |
| ErrorPropagation | step 실패 → 상위 전파 규칙 (에러 계층) |
| CancellationToken | race/timeout 패자 취소 (협력적) |
| PipeContext | step 간 데이터 전달 + 필드 조회 |
| PipeRunner | PipeGraph 실제 실행 런타임 |
| PathMatcher | 실행 결과 ↔ PipeSpec 매칭 (VerdictReport v2) |
| ~~기존 graph-matcher 대체~~ | ✅ 완료 (2026-04-03, graph-matcher 삭제) |

### Phase 4: 표준 호환 + 통합

| 항목 | 설명 |
|------|------|
| toCloudEvent/fromCloudEvent | EventRecord ↔ CloudEvents 변환 |
| AsyncAPI 생성기 | manifest + event-catalog → 명세 |
| registry-service 매니페스트 통합 | ManifestRegistry → API 노출 |
| 기존 ScenarioSpec deprecated | PipeSpec으로 완전 전환 후 |

---

## 5. 하위 호환 전략 — 제거 용이 설계

### 원칙: compat 분리 패턴

deprecated 코드는 `compat.*` 파일로 분리한다.
새 코드는 compat를 import하지 않는다.
제거 시 compat 파일만 삭제하면 된다.

```
v2 코드 (새 체계):
  pipe-spec.ts          → PipeSpec, PipeFlow
  path-matcher.ts       → PathMatcher
  scope-registry.ts     → ScopeRegistry
  version-manifest.ts   → ManifestRegistry

compat (제거 대상):
  compat.ts             → ASPECT_TO_SCOPE (이미 분리됨)
  compat-scenario.ts    → ScenarioSpec ↔ PipeSpec 변환기
  compat-graph.ts       → SpecGraph ↔ PathModel 변환기
  compat-verdict.ts     → VerdictReport v1 ↔ v2 변환기
```

### 제거 체크리스트

```
Phase 2 완료 시:
  □ 모든 신규 시나리오가 PipeSpec으로 작성됨
  □ compat-scenario.ts 외에 ScenarioSpec import 없음
  → compat-scenario.ts 제거 가능

Phase 3 완료 시: ✅ (2026-04-03)
  ☑ PathMatcher가 graph-matcher의 모든 케이스 통과
  □ compat-graph.ts 외에 SpecGraph import 없음
  → compat-graph.ts 제거 가능

Phase 4 완료 시:
  □ CloudEvents 변환이 모든 외부 인터페이스에 적용됨
  □ 모든 compat 파일 import 0건
  → compat 전체 삭제
```

### 병행 기간

| 단계 | v1 | v2 | 전환 |
|------|:--:|:--:|------|
| Phase 2 | ScenarioSpec 읽기 | PipeSpec 읽기+쓰기 | 변환기로 v1→v2 자동 전환 |
| Phase 3 | ~~graph-matcher~~ | PathMatcher 단일 | ✅ 완료 |
| Phase 4 | — | 전체 v2 | compat 삭제 |

---

## 6. 위험과 대응

| 위험 | 영향 | 대응 |
|------|------|------|
| PipeSpec이 ScenarioSpec보다 표현력 부족 | 기존 시나리오 마이그레이션 실패 | Phase 2에서 기존 시나리오 전수 변환 테스트 |
| 경로 매칭이 그래프 매칭보다 성능 저하 | 대량 이벤트 처리 지연 | PathMatcher 벤치마크 후 결정 |
| 병행 기간 유지 비용 | 두 체계 동시 지원 부담 | Phase별 기한 설정, feature flag로 전환 |
