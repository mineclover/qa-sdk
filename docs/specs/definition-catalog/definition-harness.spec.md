---
def:
  id: definition-harness
  level: module
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: operation
  svc: definition-service
  tags: [entry-point, tier-system]
  links:
    - target: definition-state-model
      type: depends_on
    - target: definition-taxonomy
      type: depends_on
    - target: spec-verification-system
      type: depends_on
    - target: definition-harness-cli
      type: contains
    - target: definition-harness-persistence
      type: contains
    - target: definition-harness-derive
      type: contains
---
# Definition Harness — 상태 기반 시스템 관리 자동화

## 목적 ^purpose

유한 상태 모델(state-model)을 실제 시스템에 적용하는 접착층. 11개 머신을 통합 관리하고, 머신 간 의존 관계(cascade/guard/notify)를 선언적으로 처리하며, SDK 이벤트로 모든 전이를 수집한다. state-model이 엔진이라면 harness는 엔진을 차에 장착하고 텔레메트리를 연결하는 것이다.

## 구성 ^overview

3개 하위 모듈 + SDK 수집 경로:

- `definition-harness-cli`: CLI에서 상태 분포 조회, 전이 실행, 프로세스 실행
- `definition-harness-persistence`: 상태 인스턴스를 def-config.json 또는 DB에 영속화
- `definition-harness-derive`: 코드/테스트/문서 상태에서 머신 상태 자동 파생

SDK 수집: `harness-tracker.ts` → `harness.transition` / `harness.process_step` / `harness.guard_check` 이벤트 → ingest-server

## 11개 상태 머신 ^constraint

state-model의 4개 기존 머신 + 7개 시스템 머신을 통합 관리한다.

### 기존 4개 (state-model.ts)

| 머신 ID | 엔티티 | 상태 | 초기 |
|---------|--------|------|------|
| `doc-lifecycle` | 문서 | draft→review→approved→deprecated→archived | draft |
| `spec-impl` | 스펙 문서 | designed→implementing→implemented→verified→source-referenced | designed |
| `convention-compliance` | 컨벤션 문서 | unverified→partial→compliant→violated | unverified |
| `db-sync` | 시스템 | out-of-sync→syncing→synced→drift-detected | out-of-sync |

### 신규 7개 (harness-state-model.ts)

| 머신 ID | 엔티티 | 상태 | 초기 |
|---------|--------|------|------|
| `address-state` | prefix 주소 | active/inactive/open/reserved | open |
| `version-lifecycle` | prefix 버전 | draft→released→active→deprecated | draft |
| `decision-flow` | 의사결정 인스턴스 | pending→active→completed/abandoned/blocked | pending |
| `service-status` | 서비스 | active→deprecated→retired | active |
| `event-status` | 이벤트 | active→deprecated→retired | active |
| `metric-health` | 메트릭 | ok→warning→critical | ok |
| `policy-candidate` | 정책 후보 | candidate→approved/rejected/modified | candidate |

## 머신 간 의존 관계 ^intent

3종 의존 유형으로 머신 간 상호작용을 선언적으로 정의:

| 유형 | 의미 | 예시 |
|------|------|------|
| **cascade** | A가 전이하면 B도 자동 전이 | version:deprecated → address:inactive |
| **guard** | A가 특정 상태여야 B 전이 허용 | version:active ← address:active |
| **notify** | A가 전이하면 B에 이벤트 전달 | metric:critical → flow:blocked |

### 현재 의존 7건

```
version:deprecated  ──cascade──→ address:inactive     (버전 폐기 → 주소 비활성화)
version:active      ──guard────→ address:active        (주소 활성화에는 active 버전 필요)
doc:approved        ──guard────→ convention:compliant   (컨벤션 준수는 승인된 문서만)
service:deprecated  ──cascade──→ event:deprecated      (서비스 폐기 → 소유 이벤트 폐기)
metric:critical     ──notify───→ flow:blocked          (메트릭 위험 → 의사결정 차단)
flow:completed      ──notify───→ doc:review            (의사결정 완료 → 문서 검토)
spec:verified       ──cascade──→ convention:compliant   (스펙 검증 → 컨벤션 준수)
```

## 프로세스 — 복수 머신 전이 시퀀스 ^outputs

반복되는 워크플로우를 명명된 프로세스로 정의. 각 스텝에 precondition과 rollback 지점을 선언.

### prefix-release (Prefix 릴리스)

```
1. version-lifecycle → released   (버전 릴리스)
2. version-lifecycle → active     (버전 활성화, precondition: released)
3. address-state     → active     (주소 활성화, precondition: version active)
4. db-sync           → syncing    (DB 동기화 시작)
5. db-sync           → synced     (DB 동기화 완료)
```

### doc-approval (문서 승인)

```
1. doc-lifecycle           → review     (검토 요청)
2. doc-lifecycle           → approved   (문서 승인)
3. convention-compliance   → compliant  (컨벤션 검증, precondition: doc approved)
```

### service-deprecation (서비스 폐기)

```
1. service-status    → deprecated  (서비스 폐기 선언)
   cascade: event-status → deprecated (자동)
2. version-lifecycle → deprecated  (관련 prefix 버전 폐기)
   cascade: address-state → inactive (자동)
3. doc-lifecycle     → deprecated  (관련 문서 폐기)
```

## SDK 수집 경로 ^api-surface

모든 전이가 SDK 이벤트로 자동 수집된다.

### 좌표 정의

```
Axes:
  harness_machine  (11 entries, capacity 16)  — 상태 머신 식별
  harness_state    (34 entries, capacity 64)  — 전이 후 상태
  harness_trigger  (8 entries, capacity 16)   — 전이 트리거

Prefix:
  harness_transition = svc_ref × harness_machine × harness_state × harness_trigger
```

### 이벤트 3종

| event_key | 설명 | payload |
|-----------|------|---------|
| `harness.transition` | 단일 전이 | machine_id, entity_id, from_state, to_state, trigger |
| `harness.process_step` | 프로세스 스텝 | process_id, step_index, machine_id, target_state, success |
| `harness.guard_check` | 가드 검증 | target_machine, target_state, ok, violations[] |

### 사용법

```typescript
import { createHarnessTracker } from "definition-catalog";
import { createHarnessRegistry } from "definition-catalog";

const tracker = createHarnessTracker({ logger, registry: createHarnessRegistry() });

// 단일 전이 — harness.transition 이벤트 자동 emit
tracker.transition("doc-lifecycle", "my-spec.md", "review", "user_action");

// 프로세스 실행 — 각 스텝마다 harness.process_step emit
tracker.runProcess("prefix-release", "service:v2");

// cascade 자동 — version deprecated → address inactive + 별도 이벤트
tracker.transition("version-lifecycle", "service:v2", "deprecated", "api_call");
```

## 품질 게이트 통합 — 문서 그래프 기반 검증

상태 머신 관리와 별개로, anchor 문서(unit/module/leaf)의 **완성도**를 계약 문서 기반으로 검증하는 경로가 존재한다.

### 문서 그래프 → 게이트 도출

anchor 문서의 하위 문서는 두 역할로 나뉜다:

| 역할 | 문서 유형 | 하네스에서의 기능 |
|------|----------|-----------------|
| **개념 보조** | feature, flow, state, data | anchor의 의미를 구성 |
| **계약 선언** | interface, constraint | 품질 게이트의 근거 — anchor 완성도의 증명 |

계약 문서의 scope × aspect가 어떤 GateKind가 필요한지를 결정한다 (`work-domain/harness.ts:deriveGateKinds()`).

### 6단계 프로세스

```
1. Define    — anchor 문서 그래프를 루트로 시작, contains/constrains 탐색
2. Resolve   — 계약 문서에서 contract markers 추출, GateKind 도출
3. Gather    — 계약/제약/scope 관련 문서 컨텍스트 조립
4. Execute   — 비용 순 실행 (static → unit → integration → system)
5. Judge     — 각 gate 결과를 계약 문서 기준과 대조
6. Route     — 미통과 → lifecycle 피드백, 전체 통과 → anchor 검증 완료
```

### 2계층 상태 모델

| 계층 | 질문 | 상태 | 코드 SSOT |
|------|------|------|----------|
| **구조적** | "문서가 충분한가" | concept-defined → contract-bound → gate-bound → verified | `work-domain/harness-model.ts` |
| **런타임** | "게이트가 통과했는가" | idle → blocked → ready → gathering → running → passed/failed/stale | `work-domain/harness.ts` |

연결: 구조적 `verified` = 런타임 `BundleState === "complete"`. 11개 머신 중 `convention-compliance` 머신이 이 결과를 소비한다 (gate verified → convention compliant).

### CLI 접근 경로

- `qa-sdk def state` — 11개 머신 상태 분포 (상태 관리 경로)
- `qa-sdk quality list/run/show` — 게이트 문서 실행 (품질 검증 경로)

두 경로는 독립적으로 동작하되, `convention-compliance` 머신을 통해 합류한다.

## 관련 소스

- `definition-catalog/src/state-model.ts` — FSM 엔진 (순수 함수)
- `definition-catalog/src/harness-state-model.ts` — 11개 머신 + 의존 + 프로세스 선언
- `definition-catalog/src/harness-tracker.ts` — SDK 이벤트 수집 연결
- `work-domain/src/harness.ts` — 런타임 상태 머신 (GateState, BundleState, buildHarnessPlan)
- `work-domain/src/harness-model.ts` — 구조적 상태 모델 (HarnessStateId, deriveHarnessState)
- `work-domain/src/gate-kind.ts` — 19종 GateKind 택소노미
- `cli/src/commands/quality.ts` — CLI quality 커맨드 (list/show/run/bundle/next)
- `event-catalog/src/categories/execution.ts` — 하네스 이벤트 3종 정의
- `event-catalog/src/prefix-mapping.ts` — HARNESS_EVENT_MAPPINGS
- `demo-snapshot/src/demo-catalog.ts` — harness_machine/state/trigger 축 + harness_transition prefix
