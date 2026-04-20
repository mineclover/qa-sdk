---
def:
  tier: component
  id: definition-mgmt-observability-planes
  type: knowledge
  knowledge_kind: proposal
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [observability]
  links:
    - target: definition-mgmt-observability-model
      type: refines
    - target: definition-mgmt-state-tracking
      type: depends_on
    - target: definition-mgmt-verification-loop
      type: depends_on
---
# Definition Management — Observability Planes

## 목적 ^purpose

definition 관리 관측 모델의 핵심 평면과 제어 루프 심볼을 고정한다. 이후 이벤트, dashboard, quality surface는 이 평면들의 projection으로만 추가되어야 한다.

## 4개 핵심 평면

| 평면 | 질문 | 주 데이터 |
|------|------|----------|
| Definition Plane | 무엇이 정의돼 있고 어떻게 연결되는가 | doc graph, links, code_references |
| State Plane | 지금 어떤 상태인가 | doc-lifecycle, spec-impl, convention, db-sync, harness |
| Decision Plane | 왜 이런 구조/상태가 되었는가 | decision_event, decision_path, model_apply, forcing_response, dkg_decision_event |
| Verification Plane | 지금 믿어도 되는가 | validate, quality_event, gate_execution, bundle_observation, test_event |

## 제어 루프 심볼

```text
G = Definition Graph
X = State Vector
D = Decision Trace
V = Verification Trace
O = Observation Ledger

r = target state
u = control action
e = error vector
y = observed projection
```

| 심볼 | 의미 |
|------|------|
| `G` | 문서/코드 연결 정의 그래프 |
| `X` | 현재 상태 벡터 |
| `D` | 의사결정 인과 추적 |
| `V` | 검증 및 gate 추적 |
| `r` | 목표 상태 |
| `u` | edit/sync/validate/gate/decide 같은 제어 입력 |
| `e` | drift, failed gate, broken link, broken code reference 같은 오차 |
| `y` | prefix bundle + payload로 표현한 관측 결과 |

## projection 원칙

- Timeline, Drift, Coverage, Hotspot은 모두 위 4개 평면의 파생 projection이다.
- local SQLite audit, 중앙 ingest event, dashboard summary는 서로 다른 저장/조회 표면이지만 의미 평면은 공유해야 한다.
