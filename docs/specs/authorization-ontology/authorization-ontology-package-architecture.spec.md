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
- `projectAuthorizationDecision`
- `projectCerbosDecisionObservation`
- `projectEnforcementRoute`
- `normalizeStructuredEnforcementRoute`
- `projectStructuredEnforcementRoute`
- `projectApplicationAuthorizationBinding`
- `normalizeStructuredApplicationAuthorization`
- `projectStructuredApplicationAuthorization`
- `parseNginxProxyLocations`
- `projectNginxProxyConfig`
- `mergeAuthorizationGraphs`
- `auditAuthorizationGraph`

패키지는 `operational-ontology`에 의존한다. 권한 전용 DB나 PDP를 포함하지 않는다.

Nginx projection은 `NginxProxyConfigProjectionOptions.policyByPath`를 통해 route path별 policy를 받는다. 이 값은 실제 policy repository를 읽는 adapter가 아니라, infra layer가 이미 해석한 route-policy wiring 결과를 ontology graph로 투영하기 위한 주입 지점이다.

audit surface는 Cerbos PDP를 대체하지 않는다. `auditAuthorizationGraph()`는 선언 graph와 관측 graph가 연결되어 있는지 검사하고, 누락된 route policy, decision policy/action/resource 연결, dangling relation을 report한다.

application enforcement surface는 서비스 내부 middleware가 어떤 domain resource와 action을 Cerbos policy로 보호하는지 선언한다. proxy route graph와 달리 보호 대상은 `domain_resource`이고 enforcement point kind는 기본적으로 `service_middleware`다.
