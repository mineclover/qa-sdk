---
def:
  id: data-model-guide
  type: knowledge
  knowledge_kind: guide
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  tags: [entry-point, data, structural]
  links:
    - target: guides-system
      type: refines
---
# Data Model

## 목적 ^purpose

ingest-server의 핵심 데이터 모델(Record, Trace, Session, Verdict, Scenario)의 스키마와 관계를 정의한다.


시스템 전체 데이터 구성 요약. 상세 스펙은 `docs/specs/data-model/` 참조.

---

## 수집 단계 — SDK → Ingest

```
TransmissionEnvelope
  ├─ transmission_id, sent_at
  ├─ owner:   { owner_type: "tenant"|"workspace"|"user"|"agent", owner_id }
  ├─ source:  { service_name, sdk_name, sdk_version }
  ├─ runtime: { platform, os_version, device_ref?, app_version? }
  ├─ build:   { env: "local"|"dev"|"staging"|"production", build_ref?, release_version? }
  └─ records: EventRecord[]
```

```
EventRecord
  ├─ log_id, timestamp
  ├─ trace_id, span_id, parent_span_id?
  ├─ record_kind: "log" | "span" | "metric"
  ├─ event_key, event_version
  ├─ span_name?, start_time?, end_time?, status_code?   ← span 전용
  ├─ metric_type?: "counter"|"gauge"|"histogram"|"summary"  ← metric 전용
  ├─ metric_name?, metric_value?, metric_unit?
  ├─ payload_format, payload_encoding
  ├─ payload_masking_applied, payload_masked_fields[]
  ├─ payload: unknown
  ├─ qa_session_id?
  ├─ actor_id?           ← 행위 주체 식별자 (사람, 봇, 에이전트)
  ├─ user_id?            ← 실제 서비스 유저 ID (PII, 선택)
  └─ user_attributes?    ← 익명 분류 속성 { age_group, tier, ... }
```

---

## 시나리오 정의 — 기대 행동 DSL

```
ScenarioSpec
  ├─ scenario_id, version, domain, description?
  ├─ entry_conditions?: EntryCondition[]
  │    └─ { field, op: "eq"|"neq"|"exists"|"gt"|"lt"|"contains", value? }
  └─ steps: ScenarioStep[]
       ├─ id, event_key, event_version?, source?, record_kind?
       ├─ required: boolean
       ├─ kind: "sequence" | "optional" | "branch"
       ├─ constraints?: StepConstraint[]
       │    └─ { field, op: "eq"|"neq"|"exists"|"gt"|"lt"|"contains"|"masked", value? }
       ├─ timeout_ms?
       ├─ next?: string[]          ← 다음 step id 목록
       └─ branches?: BranchDef[]
            └─ { condition: StepConstraint, next: string[] }
```

---

## 그래프 쌍 — 기대 vs 실제

### SpecGraph (기대 행동, ScenarioSpec 컴파일 결과)

```
SpecGraph
  ├─ scenario_id, version
  ├─ entry_conditions?               ← ScenarioSpec에서 전달
  ├─ nodes: SpecNode[]
  │    └─ step_id, event_key, required, kind
  │       event_version?, source?, record_kind?
  │       constraints?, timeout_ms?
  └─ edges: SpecEdge[]
       └─ source, target
          type: "sequence" | "branch" | "optional"
          condition?                 ← branch 엣지의 분기 조건
```

### RuntimeGraph (실제 관측, 수집된 레코드로 재구성)

```
RuntimeGraph
  ├─ trace_id
  ├─ nodes: RuntimeNode[]
  │    └─ id, log_id, timestamp, record_kind
  │       event_key, event_version
  │       service_name?, span_name?, start_time?, end_time?, status_code?
  │       payload, payload_masking_applied, payload_masked_fields[]
  └─ edges: RuntimeEdge[]
       └─ source, target
          type: "temporal" | "parent_child" | "causal"
```

---

## 판정 결과

```
VerdictReport
  ├─ scenario_id, trace_id, qa_session_id?
  ├─ overall_verdict: "pass"|"fail"|"warn"|"degraded"|"unknown"|"skipped"
  ├─ step_matches: StepMatch[]
  │    └─ step_id, matched_node_id?, verdict
  │       constraint_results[]: { constraint, passed, actual? }
  ├─ missing_steps: string[]         ← required인데 미관측
  ├─ unexpected_nodes: string[]      ← spec에 없는 이벤트
  ├─ ordering_violations[]
  │    └─ step_id, should_follow     ← sequence 순서 위반
  │       actual_timestamp, predecessor_timestamp
  ├─ latency_violations[]
  │    └─ step_id, expected_ms, actual_ms
  ├─ summary: string
  ├─ computed_at: string
  └─ path_observation?               ← 경로 관측 결과
```

> `"skipped"`: `entry_conditions` 미충족 시 매칭 없이 삽입되는 verdict

---

## 세션 & 저장 계층

```
ActorContext
  ├─ actor_id: string          ← 필수. pseudonymized token / bot ID / agent ID
  ├─ user_id?: string          ← PII 허용 시 제공 (선택)
  └─ user_attributes?: Record  ← 익명 분류 e.g. { age_group:"30s", tier:"premium" }

QaSession (논리 세션)
  └─ qa_session_id, scenario_id?, started_at, labels?

StoredTrace (trace 메타데이터)
  └─ traceId, sessionId, serviceName
     actorId, userId, userAttributes   ← 레코드에서 전파
     recordCount, firstTimestamp, lastTimestamp, reconstructed

StoredSession
  └─ sessionId, scenarioId, labels
     actorId, userId, userAttributes   ← 레코드에서 전파
     startedAt, closedAt

StoredRecord (내부 camelCase 표현, EventRecord 1:1 대응)
  └─ logId, traceId, spanId, timestamp, eventKey, ...
     qaSessionId?, actorId?, userId?, userAttributes?, createdAt
```

---

## 전체 데이터 흐름

```
SDK
  TransmissionEnvelope { records: EventRecord[] }
        │ POST /v1/ingest
        ▼
Ingest Server
  StoredRecord[]  ─→  StoredTrace (메타)  ─→  QaSession
        │ reconstruct
        ▼
  RuntimeGraph
        │ compileSpec(ScenarioSpec) → SpecGraph
        │ matchViaPathMatcher(SpecGraph, RuntimeGraph)
        ▼
  VerdictReport  →  StoredVerdict
        │
        │ Phase 2.5 (TRANSITION_ENGINE_ENABLED)
        ▼
  TransitionInstance[]  →  StateStore (축별 상태)
        │
        │ SSE /v1/streams/scenarios/:scenarioId
        ▼
viz-web (실시간 시각화)
```

---

## 전이 해석 — Transition Spec DSL

```
TransitionSpec
  ├─ transition: string         ← <domain>.<entity>.<operation>
  ├─ version: string
  ├─ match: MatchPattern
  │    ├─ mode: "single" | "ordered"
  │    └─ coordinates: CoordinatePattern[]  ← 축 이름 → entry 값
  ├─ bind: BindDef
  │    ├─ context_id: string    ← $.events[N].field
  │    └─ resource_id: string
  ├─ input: InputCondition
  │    └─ all: StateCondition[] ← axis + eq/neq/in/exists
  ├─ output: OutputMutation
  │    └─ set: StateAssignment[] ← axis + value (string | null)
  └─ effect: EffectDef
       └─ kind: "create"|"update"|"move"|"consume"|"open"|"close"
```

```
TransitionInstance
  ├─ transition_name, spec_version
  ├─ context_id, resource_id
  ├─ matched_event_ids: string[]
  ├─ input_snapshot: Record<string, string | null>
  ├─ output_snapshot: Record<string, string | null>
  ├─ effect_kind
  └─ matched_at: string (ISO timestamp)
```

```
StateStore (축 기반)
  key: (context_id, resource_id)
  value: Map<axisId, entryValue>
  │
  ├─ InMemoryStateStore  ← 개발/테스트
  └─ SqliteStateStore    ← 영속 분석
```

### 질의 API (query-service)

| 엔드포인트 | 설명 |
|---|---|
| `GET /state/:ctx/:res` | 현재 축 스냅샷 |
| `GET /state/:ctx/:res/history` | transition instance 이력 |
| `GET /state/:ctx/:res/at?ts=` | 시점 상태 (replay) |
| `GET /transitions?context_id=&limit=` | context별 전이 목록 |
