---
def:
  id: authorization-ontology-package-architecture
  type: knowledge
  knowledge_kind: concept
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: draft
  layer: domain
  tags: [security, structural]
  links:
    - target: authorization-ontology-system
      type: refines
---

# Authorization Ontology Package Architecture — 패키지 공개 표면

## 목적 ^purpose

`authorization-ontology` 패키지의 공개 타입과 helper를 정의한다. 목표는 Cerbos 정책 투영, realm 구분, principal/resource/action/policy node 생성, 컬럼 리니지 기반 권한 전파를 최소 API로 제공하는 것이다.

## 구성 ^overview

초기 패키지 surface:

- `AuthorizationRealm`
- `AuthorizationNode`
- `AuthorizationRelation`
- `projectCerbosResourcePolicy`
- `evaluateColumnPolicyPropagation`
- `projectColumnPolicyPropagation`
- `createAuthorizationDecisionNode`

패키지는 `operational-ontology`에 의존한다. 권한 전용 DB나 PDP를 포함하지 않는다.
