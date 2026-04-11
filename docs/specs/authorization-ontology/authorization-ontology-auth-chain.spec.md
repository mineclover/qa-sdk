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
