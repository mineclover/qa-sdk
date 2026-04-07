---
def:
  id: taxonomy-boundaries
  type: knowledge
  knowledge_kind: concept
  level: module
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: domain
  tags: [cross-scope, structural, entry-point]
  links:
    - target: definition-taxonomy
      type: contains
    - target: structural-taxonomy
      type: contains
    - target: observability-taxonomy
      type: contains
    - target: df-taxonomy
      type: contains
    - target: pm-taxonomy
      type: contains
    - target: decision-definition-bridge
      type: depends_on
    - target: dual-coordinate-system
      type: refines
---

# Taxonomy Boundaries — 분류 체계 패밀리와 경계

## 목적 ^purpose

qa-sdk에서 함께 쓰이는 taxonomy 패밀리들의 소유 범위와 경계를 정의한다. 같은 단어가 여러 체계에서 반복되더라도, 각 taxonomy가 답해야 하는 1차 질문을 분리하여 혼합을 막는 것이 목적이다.

## 방법 ^method

한 taxonomy는 하나의 1차 질문만 답한다.

- definition taxonomy는 "어떤 인지 관점으로 읽고 기록할 것인가"를 답한다.
- structural taxonomy는 "실제로 어떤 단위가 존재하고 어떻게 배열되는가"를 답한다.
- decision-flow taxonomy는 "왜 이런 판단을 했는가"를 답한다.
- PM taxonomy는 "무엇을 누가 언제 어떤 증거로 끝낼 것인가"를 답한다.

다른 taxonomy의 개념을 재사용할 수는 있지만, 그 taxonomy의 1차 질문까지 흡수해서는 안 된다.
책임이 확정되기 전에는 taxonomy 간 focus-shift나 해석 레이어를 깊게 설계하지 않는다.

## 위임 ^delegates

- `definition-taxonomy` → 문서 좌표와 분류 축(scope/aspect/depth/level/layer)
- `structural-taxonomy` → facet/boundary/runtime scope/contract descent의 구조 축
- `observability-taxonomy` → 앱 데이터 관측, semantic address, protocol telemetry, infra observe의 책임 경계
- `df-taxonomy` → decision-flow의 판단 추적 분류 체계
- `pm-taxonomy` → delivery 중심 PM taxonomy

## 구성 ^overview

| taxonomy | 1차 질문 | 소유 개념 | 소유하지 않는 것 |
|---|---|---|---|
| definition | 어떻게 읽고 기록하는가 | definition scope, aspect, depth, level | runtime boundary, owner/due date |
| structural | 실제 단위와 배열은 무엇인가 | facet, boundary, runtime scope, contract | 문서 진입점, backlog 상태 |
| observability | 무엇을 어떤 층위에서 관측하는가 | app-data trace, semantic address, protocol telemetry, infra observe 경계 | work item hierarchy, decision rationale |
| decision-flow | 왜 이렇게 판단했는가 | DecisionUnit, Evidence, DecisionLayer, verdict | owner, milestone, task hierarchy |
| PM | 무엇을 누가 언제 끝내는가 | initiative, epic, deliverable, task, checkpoint | cognitive phase, mental model |

## 경계 규칙 ^constraint

1. `scope`라는 단어는 taxonomy별 의미를 구분한다.
   - definition에서는 `definition scope`
   - structural에서는 `runtime scope`
   - PM에서는 `scope` 대신 `workstream`, `deliverable` 같은 용어를 쓴다.
2. decision-flow의 `DecisionUnit`은 PM item의 intent를 보강할 수 있지만, backlog item 자체를 대체하지 않는다.
3. definition taxonomy는 PM의 상태를 소유하지 않는다. 문서 lifecycle은 문서 상태이지 delivery 상태가 아니다.
4. structural taxonomy는 owner, due date, priority를 소유하지 않는다.
5. observability taxonomy는 decision rationale이나 backlog hierarchy를 소유하지 않는다.
6. PM taxonomy는 cognitive phase, mental model, forcing question을 core 축으로 편입하지 않는다.
7. taxonomy 간 연결 규칙은 책임이 고정된 뒤 별도 해석/브리지 레이어에서 다룬다.

## 관련 소스

- `docs/specs/definition-catalog/definition-taxonomy.spec.md`
- `docs/specs/system/structural-taxonomy.spec.md`
- `docs/specs/system/observability-taxonomy.spec.md`
- `docs/specs/decision-flow/df-taxonomy.spec.md`
- `docs/specs/system/pm-taxonomy.spec.md`
- `docs/specs/system/decision-definition-bridge.spec.md`
