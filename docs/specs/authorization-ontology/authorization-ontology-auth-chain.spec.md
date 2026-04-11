---
def:
  id: authorization-ontology-auth-chain
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
    - target: auth-permission-integration
      type: depends_on
---

# Authorization Ontology Auth Chain — 인증/인가 서비스 체인 모델

## 목적 ^purpose

Pulumi, ArgoCD, Cloud LB, Caddy, Authentik proxy, ZITADEL, Cerbos를 하나의 인증/인가 운영 체인으로 식별하는 모델을 정의한다. 목표는 각 컴포넌트를 권한 엔진으로 오해하지 않고, identity, enforcement, policy decision, deployment provenance 역할로 분리하는 것이다.

## 구성 ^overview

초기 역할 구분:

- **Pulumi / ArgoCD**
  배포 provenance와 service/policy wiring source
- **Cloud LB / Caddy**
  네트워크 진입점과 reverse proxy corridor
- **Authentik proxy**
  경로 차단형 enforcement point
- **ZITADEL**
  SSO identity issuer
- **Cerbos**
  authorization policy decision point

## 정의 ^defines

권한 관리 주체는 하나로 유지한다. 나머지 컴포넌트는 권한 결정을 직접 소유하는 것이 아니라, identity 발급, request ingress, path blocking, policy deployment, decision observation 중 하나의 역할을 가진다.

초기 구현은 `projectEnforcementRoute()`와 `projectStructuredEnforcementRoute()`로 제공한다. 이 helper는 Caddy/AuthentiK/Cloud LB 같은 route enforcement를 route resource, enforcement point, upstream resource, Cerbos policy, deployment source graph로 투영한다.

structured route config는 실제 Caddy/AuthentiK/Pulumi/ArgoCD parser가 생기기 전의 canonical intermediate shape다. 외부 설정 parser는 이 shape로 변환한 뒤 authorization ontology projection을 호출한다.

Nginx/Zitadel 로컬 프록시 설정은 `parseNginxProxyLocations()`와 `projectNginxProxyConfig()`로 최소 투영할 수 있다. 이 parser는 범용 Nginx parser가 아니라 `upstream`, `location`, `proxy_pass` 기반의 프록시 경로 추출용 adapter다.

Nginx adapter의 enforcement point kind는 기본적으로 `nginx_proxy`다. route path별 Cerbos policy 매핑은 `policyByPath`로 주입하며, 결과 graph는 `proxy_route -> enforced_at -> nginx_proxy`, `proxy_route -> matches_resource -> upstream service`, `policy -> protects -> proxy_route` 관계를 함께 가진다.

애플리케이션 내부 권한 처리는 `service_middleware` enforcement point로 분리한다. 이 graph는 `service -> matches_resource -> domain_resource`, `domain_resource -> enforced_at -> service_middleware`, `policy -> protects -> domain_resource` 관계를 가진다.
