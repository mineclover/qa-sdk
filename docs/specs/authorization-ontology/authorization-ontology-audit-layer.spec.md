---
def:
  id: authorization-ontology-audit-layer
  type: knowledge
  knowledge_kind: concept
  scope: constraint
  aspect: biz_constraint
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [security, structural]
  links:
    - target: authorization-ontology-system
      type: refines
    - target: authorization-ontology-cerbos-mapping
      type: depends_on
    - target: authorization-ontology-decision-observation
      type: depends_on
---

# Authorization Ontology Audit Layer — 권한 선언/적용/관측 감사

## 목적 ^purpose

Cerbos policy 선언 graph, proxy enforcement graph, decision observation graph를 비교해 권한 적용 누락과 관측 불일치를 찾는 audit layer를 정의한다. 목표는 PDP를 재구현하는 것이 아니라, 선언된 권한이 실제 route와 decision 관측에 연결되어 있는지 확인하는 것이다.

## 구성 ^overview

audit layer는 다음 graph를 입력으로 받는다.

- Cerbos resource policy graph
- Cerbos derived roles graph
- proxy route enforcement graph
- Cerbos decision observation graph
- column lineage policy propagation graph

## 정의 ^defines

`mergeAuthorizationGraphs()`는 여러 projector 출력을 하나의 graph로 합친다. 이 graph는 `realms`, `nodes`, `relations`를 canonical id 기준으로 deduplicate한다.

`auditAuthorizationGraph()`는 합쳐진 graph에서 다음을 검사한다.

- proxy route가 enforcement point에 연결되어 있는가
- proxy route가 policy로 보호되는가
- proxy route가 upstream resource에 연결되어 있는가
- decision이 resource/action/policy/enforcement relation을 가지는가
- allow decision의 action이 policy의 `allows_action` 관계로 선언되어 있는가
- decision resource가 policy의 `protects` 관계 또는 `policy -> route -> upstream` 경로로 연결되는가

Cerbos policy version은 선언 graph에는 `version=default`로 들어갈 수 있고, route/decision 관측에는 version 없이 들어올 수 있다. audit layer는 같은 realm/space/anchor를 가진 policy node를 equivalent policy로 취급해 이 차이를 흡수한다.

audit result는 authorization 결정 결과가 아니라 graph completeness report다. 실제 allow/deny 판정은 계속 Cerbos가 담당한다.
