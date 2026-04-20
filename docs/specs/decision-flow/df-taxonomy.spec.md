---
def:
  id: df-taxonomy
  type: knowledge
  knowledge_kind: concept
  level: module
  tier: system
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: domain
  svc: decision-flow
  tags: [decision, structural, entry-point]
  links:
    - target: df-axis-model
      type: contains
    - target: df-observation-space
      type: contains
    - target: df-state-model
      type: contains
    - target: df-constraint
      type: contains
    - target: df-dev-decisions
      type: contains
    - target: axis-decision-guide
      type: contains
    - target: taxonomy-boundaries
      type: refines
---

# Decision Flow Taxonomy — 판단 추적 분류 체계

## 목적 ^purpose

decision-flow가 소유하는 분류 체계를 한 곳에서 정리한다. 이 taxonomy의 목적은 delivery를 관리하는 것이 아니라, 의사결정이 어떤 구조와 근거와 거버넌스 아래에서 이루어졌는지 추적하는 것이다.

## 방법 ^method

decision-flow taxonomy는 4개 층으로 읽는다.

1. **설명 축**
   11개 axis가 판단의 성격을 분해한다.
2. **관측 축**
   5개 prefix가 판단 이벤트와 경로를 관측 가능하게 만든다.
3. **거버넌스 축**
   GateWeight, DecisionLayer, DecisionContext가 영향 범위와 경계 횡단 규칙을 정의한다.
4. **런타임 축**
   FlowStatus, DecisionVerdict, DecisionUnit이 진행 상태와 결론을 기록한다.

## 정의 ^defines

- `DecisionUnit` — topic, objective, successCriteria로 결정의 단위를 고정
- `Evidence` — 근거 종류와 가중치
- `DecisionLayer` — strategic/tactical/operational/execution 4계층
- `DecisionContext` — ownedFlows/exports/imports를 가진 거버넌스 경계
- `FlowStatus` — 과정 상태
- `DecisionVerdict` — 결과 판정

## 구성 ^overview

| 층 | 소유 개념 | 대표 문서 |
|---|---|---|
| 설명 축 | cognitive_phase, evidence_kind, mental_model, scope_mode, reversibility, magnitude 등 11개 axis | `df-axis-model` |
| 관측 축 | decision_event, decision_path, escalation_event, model_apply, forcing_response | `df-observation-space` |
| 거버넌스 축 | GateWeight, DecisionLayer, DecisionContext, escalation | `df-constraint` |
| 런타임 축 | FlowStatus, DecisionVerdict, DecisionUnit, narrative | `df-state-model` |
| 작업 수준 적용 | 5개 dev decision flow + 정책 라우터 | `df-dev-decisions` |

## 경계 규칙 ^constraint

- decision-flow taxonomy는 `왜 이렇게 판단했는가`를 소유한다.
- decision-flow taxonomy는 backlog item의 owner, due date, milestone, delivery hierarchy를 소유하지 않는다.
- `DecisionUnit`은 PM item의 intent를 보강할 수 있지만 initiative/epic/task를 직접 대체하지 않는다.
- `FlowStatus`는 판단 과정의 상태이고, delivery 전체의 상태 체계를 직접 대체하지 않는다.
- cognitive phase, mental model, forcing question은 생각 추적용이며 PM taxonomy의 core 축으로 편입하지 않는다.

## 관련 소스

- `packages/decision-flow/src/types.ts`
- `packages/decision-flow/src/vocabulary.ts`
- `packages/decision-flow/src/catalog.ts`
- `packages/decision-flow/src/boundary.ts`
- `packages/decision-flow/src/sprint.ts`
