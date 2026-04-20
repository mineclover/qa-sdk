---
def:
  tier: component
  id: authorization-ontology-application-enforcement
  type: knowledge
  knowledge_kind: concept
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [security, structural]
  links:
    - target: authorization-ontology-system
      type: refines
    - target: authorization-ontology-cerbos-mapping
      type: depends_on
    - target: authorization-ontology-audit-layer
      type: depends_on
---

# Authorization Ontology Application Enforcement — 애플리케이션 권한 적용 모델

## 목적 ^purpose

서비스 내부 middleware나 handler에서 수행하는 fine-grained authorization을 authorization ontology graph로 투영하는 방식을 정의한다. 목표는 proxy route 차단과 별도로, 도메인 리소스/인스턴스/action 단위의 권한 적용 지점을 명시적으로 관측하는 것이다.

## 구성 ^overview

application enforcement graph는 다음 요소를 가진다.

- service resource
- domain resource
- service middleware enforcement point
- Cerbos policy
- action
- deployment source

## 정의 ^defines

`projectStructuredApplicationAuthorization()`은 애플리케이션 내부 권한 binding을 graph로 변환한다.

기본 관계는 다음과 같다.

- `service -> matches_resource -> domain_resource`
- `domain_resource -> enforced_at -> service_middleware`
- `policy -> protects -> domain_resource`
- `action -> evaluated_by -> service_middleware`
- `domain_resource -> deployed_by -> deployment_source`

proxy enforcement는 route 입구 차단을 다루고, application enforcement는 서비스 내부 도메인 리소스 접근 제어를 다룬다. 두 graph는 같은 Cerbos policy id를 공유할 수 있지만 보호 대상은 각각 `proxy_route`와 `domain_resource`로 구분된다.

application decision observation은 기존 `projectCerbosDecisionObservation()`을 사용한다. 이때 resource kind는 `domain_resource`를 사용하고, enforcement point kind는 `service_middleware`를 사용한다.
