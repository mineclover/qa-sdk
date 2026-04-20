---
def:
  tier: component
  id: authorization-ontology-decision-observation
  type: knowledge
  knowledge_kind: concept
  scope: flow
  aspect: relation
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [security, observability, structural]
  links:
    - target: authorization-ontology-system
      type: refines
    - target: authorization-ontology-cerbos-mapping
      type: depends_on
    - target: operational-ontology-checkpoint
      type: depends_on
---

# Authorization Ontology Decision Observation — Cerbos 판정 관측 모델

## 목적 ^purpose

Cerbos check 결과를 authorization ontology의 decision graph로 남기는 방식을 정의한다. 목표는 권한 정책 선언이 실제 요청에서 어떤 principal/resource/action/effect로 판정되었는지 관측 가능하게 만드는 것이다.

## 구성 ^overview

decision observation은 아래 요소를 가진다.

- principal
- resource
- action
- effect
- policy
- enforcement point
- observedAt
- reason

초기 구현은 `projectAuthorizationDecision()`과 `projectCerbosDecisionObservation()`으로 제공한다.

## 정의 ^defines

Cerbos decision은 단순 allow/deny boolean이 아니다. authorization ontology에서는 decision을 별도 node로 만들고, decision이 참조한 principal, resource, action, policy, enforcement point를 relation으로 연결한다.

이 구조를 통해 다음 질문에 답할 수 있다.

- 어떤 ZITADEL principal이 판정 대상이었는가?
- 어떤 resource/action 조합이 평가되었는가?
- 어떤 Cerbos policy가 판정 근거였는가?
- 어느 Authentik/Caddy/service enforcement point에서 관측되었는가?
- 실제 decision이 선언된 policy topology와 일치하는가?
