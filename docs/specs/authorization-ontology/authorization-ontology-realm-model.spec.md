---
def:
  tier: component
  id: authorization-ontology-realm-model
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
    - target: operational-ontology-core-model
      type: depends_on
---

# Authorization Ontology Realm Model — 권한 authority boundary 정의

## 목적 ^purpose

authorization ontology에서 realm을 단순 namespace가 아니라 식별자와 의미를 발급하고 책임지는 권위 경계로 정의한다. 목표는 서비스 종류, 리소스 종류, 정책 종류를 realm으로 혼동하지 않고, 권한 선언과 관측의 책임 경계를 안정적으로 나누는 것이다.

## 구성 ^overview

초기 realm kind는 다음을 기준으로 한다.

- `identity`
- `policy`
- `enforcement`
- `infra`
- `application`
- `data`
- `observation`

예시:

- `identity:zitadel:prod`
- `policy:cerbos:prod`
- `enforcement:authentik:prod`
- `infra:k8s:prod`
- `data:bq:commerce:analytics`

## 정의 ^defines

realm은 아래 질문으로 나눈다.

- 같은 ID를 번역 없이 비교할 수 있는가?
- 같은 lifecycle로 관리되는가?
- 같은 owner/governance가 책임지는가?
- 같은 policy engine이 의미를 해석하는가?
- 같은 compliance/data boundary 안에 있는가?

`resource_kind=column`, `resource_kind=api_route` 같은 값은 realm이 아니라 taxonomy axis다.
